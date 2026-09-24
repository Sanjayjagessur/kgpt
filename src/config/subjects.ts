/**
 * Subject catalogue. Display names live in messages (`subjects.<id>`),
 * structure (units, lessons) lives in the database. The hue is fed into the
 * subject colour recipe in globals.css so every subject keeps one colour in
 * both themes.
 */
export const SUBJECT_IDS = [
  "art-design",
  "biology",
  "business",
  "chemistry",
  "design-technology",
  "drama",
  "english",
  "english-literature",
  "food-textiles",
  "french",
  "french-literature",
  "ict",
  "kreol-morisien",
  "life-skills",
  "mathematics",
  "physical-education",
  "physics",
  "sexuality-education",
  "social-modern-studies",
] as const;

export type SubjectId = (typeof SUBJECT_IDS)[number];

export type SubjectMeta = {
  id: SubjectId;
  /** OKLCH hue, 0–360 */
  hue: number;
  grades: readonly number[];
};

const range = (from: number, to: number) =>
  Array.from({ length: to - from + 1 }, (_, i) => from + i);

export const SUBJECTS: Record<SubjectId, SubjectMeta> = {
  "art-design": { id: "art-design", hue: 342, grades: range(7, 13) },
  biology: { id: "biology", hue: 133, grades: range(7, 13) },
  business: { id: "business", hue: 57, grades: range(7, 13) },
  chemistry: { id: "chemistry", hue: 304, grades: range(7, 13) },
  "design-technology": { id: "design-technology", hue: 38, grades: range(7, 13) },
  drama: { id: "drama", hue: 0, grades: range(7, 11) },
  english: { id: "english", hue: 209, grades: range(7, 13) },
  "english-literature": { id: "english-literature", hue: 285, grades: range(10, 13) },
  "food-textiles": { id: "food-textiles", hue: 19, grades: range(7, 11) },
  french: { id: "french", hue: 247, grades: range(7, 13) },
  "french-literature": { id: "french-literature", hue: 190, grades: range(10, 13) },
  ict: { id: "ict", hue: 171, grades: range(7, 13) },
  "kreol-morisien": { id: "kreol-morisien", hue: 76, grades: range(7, 11) },
  "life-skills": { id: "life-skills", hue: 152, grades: range(7, 9) },
  mathematics: { id: "mathematics", hue: 266, grades: range(7, 13) },
  "physical-education": { id: "physical-education", hue: 114, grades: range(7, 13) },
  physics: { id: "physics", hue: 228, grades: range(7, 13) },
  "sexuality-education": { id: "sexuality-education", hue: 323, grades: range(7, 11) },
  "social-modern-studies": { id: "social-modern-studies", hue: 95, grades: range(7, 11) },
};

export const GRADES = range(7, 13);

export function isSubjectId(value: string): value is SubjectId {
  return (SUBJECT_IDS as readonly string[]).includes(value);
}

export function subjectsForGrade(grade: number): SubjectMeta[] {
  return SUBJECT_IDS.map((id) => SUBJECTS[id]).filter((s) => s.grades.includes(grade));
}

export function subjectStyle(id: SubjectId): React.CSSProperties {
  return { ["--s-h" as string]: SUBJECTS[id].hue };
}

/** Curriculum stage for a grade: NCF (7–9), SC (10–11), HSC (12–13). */
export function stageForGrade(grade: number): "ncf" | "sc" | "hsc" {
  if (grade <= 9) return "ncf";
  if (grade <= 11) return "sc";
  return "hsc";
}
