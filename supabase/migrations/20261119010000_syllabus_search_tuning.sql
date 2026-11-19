-- Tuning after testing search_syllabus on real student questions (19 Nov 2026).
-- 1. Kreol Morisien spelling varies ("fraksyon" / "fraksion", "nasyon" / "nasion"),
--    so Kreol text and queries are normalised before indexing and matching.
-- 2. Kreol students often type French school terms, so mfe searches also match French.
-- 3. Weak matches (a single common word like "help" or "solve") are dropped:
--    an absolute floor plus a floor relative to the best hit.

create or replace function public.mfe_normalize(p text)
returns text
language sql
immutable
parallel safe
set search_path = ''
as $$
  -- -syon/-sion and -kyon/-kion endings are the commonest Lortograf variants.
  select regexp_replace(lower(p), '([sk])yon', '\1ion', 'g');
$$;
revoke execute on function public.mfe_normalize(text) from public, anon;
grant execute on function public.mfe_normalize(text) to authenticated;

drop index if exists public.syllabus_chunks_fts_idx;
alter table public.syllabus_chunks drop column fts;
alter table public.syllabus_chunks add column fts tsvector generated always as (
  case locale
    when 'en' then setweight(to_tsvector('english'::regconfig, heading), 'A') || setweight(to_tsvector('english'::regconfig, content), 'B')
    when 'fr' then setweight(to_tsvector('french'::regconfig, heading), 'A') || setweight(to_tsvector('french'::regconfig, content), 'B')
    else setweight(to_tsvector('simple'::regconfig, public.mfe_normalize(heading)), 'A')
      || setweight(to_tsvector('simple'::regconfig, public.mfe_normalize(content)), 'B')
  end
) stored;
create index syllabus_chunks_fts_idx on public.syllabus_chunks using gin (fts);

drop function if exists public.search_syllabus(text, smallint, public.locale_code, text[], integer, real);

create or replace function public.search_syllabus(
  p_query text,
  p_grade smallint,
  p_locale public.locale_code,
  p_subjects text[],
  p_limit integer default 4,
  p_min_rank real default 0.4,
  p_relative_floor real default 0.5
)
returns table (
  id bigint,
  document_title text,
  subject_id text,
  grade_min smallint,
  grade_max smallint,
  source public.syllabus_source,
  unit_id uuid,
  heading text,
  content text,
  rank real
)
language sql
stable
security invoker
set search_path = ''
as $$
  with q as (
    select
      nullif(replace(plainto_tsquery('english'::regconfig, p_query)::text, ' & ', ' | '), '')::tsquery as en,
      nullif(replace(plainto_tsquery('french'::regconfig, p_query)::text, ' & ', ' | '), '')::tsquery as fr,
      nullif(replace(plainto_tsquery('simple'::regconfig, public.mfe_normalize(p_query))::text, ' & ', ' | '), '')::tsquery as mfe
  ),
  hits as (
    select
      c.id, d.title as document_title, c.subject_id, c.grade_min, c.grade_max, c.source, c.unit_id, c.heading, c.content,
      (ts_rank_cd(c.fts, case c.locale when 'en' then q.en when 'fr' then q.fr else q.mfe end, 1)
        * case c.source when 'official' then 1.5 when 'teacher' then 1.2 else 1.0 end
        * case when c.locale = p_locale then 1.2 else 0.8 end
        * case when p_grade between c.grade_min and c.grade_max then 1.2 else 1.0 end)::real as rank
    from public.syllabus_chunks c
    join public.syllabus_documents d on d.id = c.document_id
    cross join q
    where c.subject_id = any (p_subjects)
      and c.grade_min <= p_grade
      and (c.locale = p_locale or c.locale = 'en' or (p_locale = 'mfe' and c.locale = 'fr'))
      and c.fts @@ case c.locale when 'en' then q.en when 'fr' then q.fr else q.mfe end
  ),
  best_per_unit as (
    select distinct on (coalesce(h.unit_id::text, h.id::text)) h.*
    from hits h
    where h.rank >= p_min_rank
    order by coalesce(h.unit_id::text, h.id::text), h.rank desc
  ),
  floored as (
    select b.*, max(b.rank) over () as top from best_per_unit b
  )
  select f.id, f.document_title, f.subject_id, f.grade_min, f.grade_max, f.source, f.unit_id, f.heading, f.content, f.rank
  from floored f
  where f.rank >= f.top * p_relative_floor
  order by f.rank desc
  limit least(greatest(p_limit, 1), 8);
$$;

revoke execute on function public.search_syllabus(text, smallint, public.locale_code, text[], integer, real, real) from public, anon;
grant execute on function public.search_syllabus(text, smallint, public.locale_code, text[], integer, real, real) to authenticated;
