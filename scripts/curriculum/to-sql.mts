/**
 * Converts the reviewed outlines in supabase/curriculum/*.json into a seed
 * migration. Unit and lesson ids are deterministic (UUID v5 of
 * subject/grade/position), so re-seeding keeps student progress attached.
 *
 *   node scripts/curriculum/to-sql.mts <migration-file>
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DIR = path.resolve("supabase/curriculum");
const OUT = process.argv[2];
if (!OUT) throw new Error("usage: to-sql.mts <migration-file>");

// Fixed namespace for myKPT curriculum ids.
const NAMESPACE = "6f1c2a7e-3b8d-4f5a-9c0e-2d4b6a8c0e1f";

function uuidv5(name: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

const lit = (value: unknown) => `'${JSON.stringify(value).replace(/'/g, "''")}'::jsonb`;

type Localized = { en: string; fr: string; mfe: string };
type Outline = { units: { title: Localized; summary: Localized; lessons: { title: Localized; objectives: string[] }[] }[] };

const unitRows: string[] = [];
const lessonRows: string[] = [];
const lessonIds: string[] = [];
let lessonCount = 0;

for (const file of fs.readdirSync(DIR).filter((f) => f.endsWith(".json")).sort()) {
  const data = JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as { subject: string; grades: Record<string, Outline> };
  for (const [grade, outline] of Object.entries(data.grades)) {
    outline.units.forEach((unit, u) => {
      const unitId = uuidv5(`${data.subject}/${grade}/${u + 1}`);
      unitRows.push(`('${unitId}', '${data.subject}', ${grade}, ${u + 1}, ${lit(unit.title)}, ${lit(unit.summary)})`);
      unit.lessons.forEach((lesson, l) => {
        const lessonId = uuidv5(`${data.subject}/${grade}/${u + 1}/${l + 1}`);
        lessonIds.push(lessonId);
        lessonRows.push(`('${lessonId}', '${unitId}', ${l + 1}, ${lit(lesson.title)}, ${lit(lesson.objectives)})`);
        lessonCount += 1;
      });
    });
  }
}

const sql = `-- Curriculum outline generated from supabase/curriculum/*.json by scripts/curriculum/to-sql.mts.
-- ${unitRows.length} units, ${lessonCount} lessons. Do not edit by hand: edit the JSON and regenerate.

insert into public.units (id, subject_id, grade, position, title, summary) values
${unitRows.join(",\n")}
on conflict (id) do update set
  title = excluded.title,
  summary = excluded.summary,
  position = excluded.position;

-- When a lesson's title or objectives change, its cached AI content is cleared so it is rewritten.
with changed as (
  insert into public.lessons (id, unit_id, position, title, objectives) values
${lessonRows.join(",\n")}
  on conflict (id) do update set
    title = excluded.title,
    objectives = excluded.objectives,
    position = excluded.position
  where (lessons.title, lessons.objectives) is distinct from (excluded.title, excluded.objectives)
  returning id, (xmax <> 0) as updated
)
delete from public.lesson_content where lesson_id in (select id from changed where updated);

-- Lessons no longer in the outline are kept (student progress points at them); report them for review.
do $$
declare orphaned integer;
begin
  select count(*) into orphaned from public.lessons
  where id not in (${lessonIds.map((id) => `'${id}'`).join(", ")});
  if orphaned > 0 then
    raise notice '% lesson(s) are no longer in the curriculum outline; review before deleting', orphaned;
  end if;
end
$$;
`;

fs.writeFileSync(OUT, sql);
console.log(`wrote ${OUT}: ${unitRows.length} units, ${lessonCount} lessons`);
