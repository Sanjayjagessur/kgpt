/**
 * Drafts the curriculum outline (units and lessons) for every subject and grade
 * with Claude, following the Mauritian national curriculum. Output is written to
 * supabase/curriculum/<subject>.json for review by educators before seeding.
 *
 *   node --env-file=.env.local scripts/curriculum/generate.mts [subject...]
 *
 * Existing grades in a file are kept, so the script can be re-run to fill gaps.
 */
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

const MODEL = "claude-sonnet-5";
const OUT_DIR = path.resolve("supabase/curriculum");
const CONCURRENCY = 6;

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => a + i);

// Mirrors src/config/subjects.ts (kept separate so this script has no app imports).
const SUBJECTS: Record<string, { name: string; grades: number[]; syllabus: string }> = {
  "art-design": { name: "Art and Design", grades: range(7, 13), syllabus: "NCF Art and Design (Grades 7–9); Cambridge O Level Art & Design 6090 (Grades 10–11); Cambridge International AS & A Level Art & Design 9479 (Grades 12–13)" },
  biology: { name: "Biology", grades: range(7, 13), syllabus: "NCF Science, biology strand (Grades 7–9); Cambridge O Level Biology 5090 (Grades 10–11); Cambridge International AS & A Level Biology 9700 (Grades 12–13)" },
  business: { name: "Business and Entrepreneurship", grades: range(7, 13), syllabus: "NCF Business and Entrepreneurship Education (Grades 7–9); Cambridge O Level Business Studies 7115 (Grades 10–11); Cambridge International AS & A Level Business 9609 (Grades 12–13)" },
  chemistry: { name: "Chemistry", grades: range(7, 13), syllabus: "NCF Science, chemistry strand (Grades 7–9); Cambridge O Level Chemistry 5070 (Grades 10–11); Cambridge International AS & A Level Chemistry 9701 (Grades 12–13)" },
  "design-technology": { name: "Design and Technology", grades: range(7, 13), syllabus: "NCF Design and Technology (Grades 7–9); Cambridge O Level Design & Technology 7048 (Grades 10–11); Cambridge International AS & A Level Design & Technology 9705 (Grades 12–13)" },
  drama: { name: "Drama", grades: range(7, 11), syllabus: "NCF Performing Arts – Drama (Grades 7–9); Cambridge IGCSE Drama 0411 (Grades 10–11)" },
  english: { name: "English", grades: range(7, 13), syllabus: "NCF English (Grades 7–9); Cambridge O Level English Language 1123 (Grades 10–11); Cambridge International AS & A Level English Language 9093 / General Paper 8021 (Grades 12–13)" },
  "english-literature": { name: "English Literature", grades: range(10, 13), syllabus: "Cambridge O Level Literature in English 2010 (Grades 10–11); Cambridge International AS & A Level Literature in English 9695 (Grades 12–13)" },
  "food-textiles": { name: "Food and Textiles", grades: range(7, 11), syllabus: "NCF Food and Textile Studies (Grades 7–9); Cambridge O Level Food & Nutrition 6065 and fashion/textiles topics (Grades 10–11)" },
  french: { name: "French", grades: range(7, 13), syllabus: "NCF Français (Grades 7–9); Cambridge O Level French 3015 (Grades 10–11); Cambridge International AS & A Level French Language 8682 / French 9898 (Grades 12–13)" },
  "french-literature": { name: "French Literature", grades: range(10, 13), syllabus: "Cambridge O Level French Literature / Literature in French (Grades 10–11); Cambridge International A Level French Literature 8670 / 9898 literature component (Grades 12–13)" },
  ict: { name: "ICT", grades: range(7, 13), syllabus: "NCF Computer Studies / ICT (Grades 7–9); Cambridge O Level Computer Science 2210 (Grades 10–11); Cambridge International AS & A Level Computer Science 9618 (Grades 12–13)" },
  "kreol-morisien": { name: "Kreol Morisien", grades: range(7, 11), syllabus: "MIE Kreol Morisien secondary syllabus (Grades 7–11): language structure, Lortograf Kreol Morisien, reading, writing, oral communication, literature and culture" },
  "life-skills": { name: "Life Skills", grades: range(7, 9), syllabus: "NCF Life Skills and Values (Grades 7–9): self-awareness, communication, decision making, wellbeing, citizenship" },
  mathematics: { name: "Mathematics", grades: range(7, 13), syllabus: "NCF Mathematics (Grades 7–9); Cambridge O Level Mathematics D 4024 (Grades 10–11); Cambridge International AS & A Level Mathematics 9709 (Grades 12–13)" },
  "physical-education": { name: "Physical Education", grades: range(7, 13), syllabus: "NCF Physical Education (Grades 7–9); Cambridge O Level / IGCSE Physical Education 0413 (Grades 10–11); Cambridge International AS & A Level Physical Education 9396 (Grades 12–13)" },
  physics: { name: "Physics", grades: range(7, 13), syllabus: "NCF Science, physics strand (Grades 7–9); Cambridge O Level Physics 5054 (Grades 10–11); Cambridge International AS & A Level Physics 9702 (Grades 12–13)" },
  "sexuality-education": { name: "Sexuality Education", grades: range(7, 11), syllabus: "Mauritius Ministry of Education comprehensive sexuality education guidelines (age-appropriate, UNESCO ITGSE aligned): growth and puberty, relationships, consent, respect, health and safety, online safety" },
  "social-modern-studies": { name: "Social and Modern Studies", grades: range(7, 11), syllabus: "NCF Social and Modern Studies (Grades 7–9); Cambridge O Level Sociology / History / Geography topics relevant to Mauritius (Grades 10–11)" },
};

const Localized = z.object({
  en: z.string().describe("English"),
  fr: z.string().describe("French"),
  mfe: z.string().describe("Kreol Morisien, using the official Lortograf Kreol Morisien spelling"),
});

const OutlineSchema = z.object({
  units: z.array(
    z.object({
      title: Localized,
      summary: Localized.describe("One sentence describing what the unit covers"),
      lessons: z.array(
        z.object({
          title: Localized,
          objectives: z.array(z.string()).describe("2 to 4 learning objectives in English, starting with a verb"),
        }),
      ),
    }),
  ),
});
type Outline = z.infer<typeof OutlineSchema>;

const SYSTEM = `You are a curriculum designer at the Mauritius Institute of Education (MIE). You design course outlines for an online learning platform used by secondary students in Mauritius.

Rules:
- Follow the named syllabus closely, in the order topics are normally taught. Use terminology Mauritian teachers and students recognise.
- Grades 7–9 follow the National Curriculum Framework (NCF). Grades 10–11 prepare for the School Certificate (SC). Grades 12–13 prepare for the Higher School Certificate (HSC).
- Produce 6 to 8 units for the grade, each with 3 to 5 lessons. Each lesson should be teachable in about 20 to 30 minutes of self-study.
- Only include topics for the requested grade; do not repeat content that belongs to earlier grades except for brief revision.
- Content must be suitable for students aged 11 to 19 and respectful of Mauritius's multicultural society. Use Mauritian contexts where natural.
- Titles are short (at most 8 words), in sentence case, with no numbering.
- Provide each title and summary in English, French and Kreol Morisien.`;

function prompt(subjectId: string, grade: number) {
  const s = SUBJECTS[subjectId];
  return `Subject: ${s.name}
Grade: ${grade}
Reference syllabus: ${s.syllabus}

Write the unit and lesson outline for this subject and grade.`;
}

const client = new Anthropic();

async function generate(subjectId: string, grade: number): Promise<Outline> {
  const response = await client.messages.parse({
    model: MODEL,
    max_tokens: 16000,
    system: SYSTEM,
    output_config: { effort: "medium", format: zodOutputFormat(OutlineSchema) },
    messages: [{ role: "user", content: prompt(subjectId, grade) }],
  });
  if (response.stop_reason === "refusal") throw new Error(`refused: ${subjectId} ${grade}`);
  if (!response.parsed_output) throw new Error(`no parsed output: ${subjectId} ${grade} (${response.stop_reason})`);
  const { input_tokens, output_tokens } = response.usage;
  console.log(`  ${subjectId} g${grade}: ${response.parsed_output.units.length} units (${input_tokens} in / ${output_tokens} out)`);
  return response.parsed_output;
}

type FileShape = { subject: string; grades: Record<string, Outline> };

function load(subjectId: string): FileShape {
  const file = path.join(OUT_DIR, `${subjectId}.json`);
  if (!fs.existsSync(file)) return { subject: subjectId, grades: {} };
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

function save(data: FileShape) {
  fs.mkdirSync(OUT_DIR, { recursive: true });
  const sorted = Object.fromEntries(Object.entries(data.grades).sort(([a], [b]) => Number(a) - Number(b)));
  fs.writeFileSync(path.join(OUT_DIR, `${data.subject}.json`), JSON.stringify({ ...data, grades: sorted }, null, 2) + "\n");
}

async function main() {
  const only = process.argv.slice(2);
  const subjectIds = only.length ? only : Object.keys(SUBJECTS);
  const files = new Map(subjectIds.map((id) => [id, load(id)]));

  const jobs = subjectIds.flatMap((id) =>
    SUBJECTS[id].grades.filter((g) => !files.get(id)!.grades[String(g)]).map((g) => ({ id, g })),
  );
  console.log(`${jobs.length} subject-grade outlines to generate`);

  let next = 0;
  const failures: string[] = [];
  async function worker() {
    while (next < jobs.length) {
      const { id, g } = jobs[next++];
      try {
        const outline = await generate(id, g);
        const data = files.get(id)!;
        data.grades[String(g)] = outline;
        save(data);
      } catch (err) {
        failures.push(`${id} g${g}: ${(err as Error).message}`);
      }
    }
  }
  await Promise.all(Array.from({ length: CONCURRENCY }, worker));
  if (failures.length) {
    console.error("Failures (re-run to retry):\n" + failures.join("\n"));
    process.exitCode = 1;
  }
}

main();
