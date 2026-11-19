-- Syllabus knowledge base (retrieval-augmented tutoring).
-- Documents and chunks are shared, read-only to signed-in students; only the
-- server (service role) writes them. Retrieval adds context to the tutor but
-- never decides whether the tutor answers.

create extension if not exists vector with schema extensions;

create type public.syllabus_source as enum ('official', 'teacher', 'generated');

create table public.syllabus_documents (
  id uuid primary key default gen_random_uuid(),
  -- Stable key from the ingest manifest (e.g. "mie-tls-maths-g7-9" or "outline:mathematics"), used for re-ingest.
  slug text not null unique check (slug ~ '^[a-z0-9:._-]+$'),
  title text not null,
  subject_id text not null references public.subjects (id) on delete cascade,
  grade_min smallint not null check (grade_min between 7 and 13),
  grade_max smallint not null check (grade_max between 7 and 13),
  locale public.locale_code not null,
  source public.syllabus_source not null,
  publisher text,
  licence text,
  url text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (grade_min <= grade_max)
);
create index syllabus_documents_subject_idx on public.syllabus_documents (subject_id, grade_min, grade_max);

create trigger syllabus_documents_updated_at before update on public.syllabus_documents
  for each row execute function private.set_updated_at();

create table public.syllabus_chunks (
  id bigint generated always as identity primary key,
  document_id uuid not null references public.syllabus_documents (id) on delete cascade,
  position integer not null,
  -- Copied from the document so search filters on one table.
  subject_id text not null references public.subjects (id) on delete cascade,
  grade_min smallint not null,
  grade_max smallint not null,
  locale public.locale_code not null,
  source public.syllabus_source not null,
  unit_id uuid references public.units (id) on delete set null,
  heading text not null default '',
  content text not null check (length(content) between 1 and 8000),
  -- Language-aware full-text index. Kreol has no Postgres dictionary, so it uses 'simple'.
  fts tsvector generated always as (
    case locale
      when 'en' then setweight(to_tsvector('english'::regconfig, heading), 'A') || setweight(to_tsvector('english'::regconfig, content), 'B')
      when 'fr' then setweight(to_tsvector('french'::regconfig, heading), 'A') || setweight(to_tsvector('french'::regconfig, content), 'B')
      else setweight(to_tsvector('simple'::regconfig, heading), 'A') || setweight(to_tsvector('simple'::regconfig, content), 'B')
    end
  ) stored,
  -- Filled later when an embeddings provider is configured (1024 dims, e.g. voyage-3.5).
  embedding extensions.vector(1024),
  unique (document_id, position)
);
create index syllabus_chunks_document_idx on public.syllabus_chunks (document_id);
create index syllabus_chunks_unit_idx on public.syllabus_chunks (unit_id);
create index syllabus_chunks_filter_idx on public.syllabus_chunks (subject_id, grade_min, locale);
create index syllabus_chunks_fts_idx on public.syllabus_chunks using gin (fts);
create index syllabus_chunks_embedding_idx on public.syllabus_chunks
  using hnsw (embedding extensions.vector_cosine_ops);

alter table public.syllabus_documents enable row level security;
alter table public.syllabus_chunks enable row level security;

create policy "syllabus readable" on public.syllabus_documents for select to authenticated using (true);
create policy "syllabus readable" on public.syllabus_chunks for select to authenticated using (true);
-- No insert/update/delete policies: writes use the service role only.

-- Ranked keyword search for the tutor. Runs as the caller (RLS applies).
-- Matches the student's subject (or any of their subjects when several are given),
-- content at or below their grade, in their language plus English as a fallback.
-- Words are OR-ed (a question rarely shares every word with the syllabus), then
-- results under p_min_rank are dropped so a single common word doesn't match.
-- Official and teacher material ranks above AI-drafted outlines; one hit per unit.
create or replace function public.search_syllabus(
  p_query text,
  p_grade smallint,
  p_locale public.locale_code,
  p_subjects text[],
  p_limit integer default 4,
  p_min_rank real default 0.1
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
      nullif(replace(plainto_tsquery('simple'::regconfig, p_query)::text, ' & ', ' | '), '')::tsquery as mfe
  ),
  hits as (
    select
      c.id, d.title as document_title, c.subject_id, c.grade_min, c.grade_max, c.source, c.unit_id, c.heading, c.content,
      (ts_rank_cd(c.fts, case c.locale when 'en' then q.en when 'fr' then q.fr else q.mfe end, 1)
        * case c.source when 'official' then 1.5 when 'teacher' then 1.2 else 1.0 end
        -- Prefer the student's language; English is a fallback.
        * case when c.locale = p_locale then 1.2 else 0.8 end
        -- Prefer content written for the student's own grade.
        * case when p_grade between c.grade_min and c.grade_max then 1.2 else 1.0 end)::real as rank
    from public.syllabus_chunks c
    join public.syllabus_documents d on d.id = c.document_id
    cross join q
    where c.subject_id = any (p_subjects)
      and c.grade_min <= p_grade
      and c.locale in (p_locale, 'en')
      and c.fts @@ case c.locale when 'en' then q.en when 'fr' then q.fr else q.mfe end
  ),
  best_per_unit as (
    select distinct on (coalesce(h.unit_id::text, h.id::text)) h.*
    from hits h
    where h.rank >= p_min_rank
    order by coalesce(h.unit_id::text, h.id::text), h.rank desc
  )
  select * from best_per_unit
  order by rank desc
  limit least(greatest(p_limit, 1), 8);
$$;

revoke execute on function public.search_syllabus(text, smallint, public.locale_code, text[], integer, real) from public, anon;
grant execute on function public.search_syllabus(text, smallint, public.locale_code, text[], integer, real) to authenticated;
