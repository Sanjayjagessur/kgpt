import { z } from "zod";

/** Shape of an AI-generated lesson, stored in lesson_content.content. */
export const LessonContentSchema = z.object({
  hook: z.string().describe("One or two sentences that connect the topic to everyday life in Mauritius"),
  sections: z
    .array(
      z.object({
        heading: z.string(),
        body: z.string().describe("Markdown. Use $...$ for inline maths and $$...$$ for display maths"),
      }),
    )
    .describe("3 to 5 teaching sections in a logical order"),
  workedExamples: z
    .array(
      z.object({
        title: z.string(),
        problem: z.string().describe("Markdown"),
        steps: z.array(z.string()).describe("Each step in Markdown, one idea per step"),
        answer: z.string().describe("Markdown"),
      }),
    )
    .describe("1 to 3 worked examples, from easier to harder"),
  checks: z
    .array(
      z.object({
        kind: z.enum(["multiple_choice", "short_answer"]),
        question: z.string().describe("Markdown"),
        options: z.array(z.string()).describe("4 options for multiple_choice; empty for short_answer"),
        correctOption: z.number().int().describe("Index of the correct option; -1 for short_answer"),
        modelAnswer: z.string().describe("Markdown model answer"),
        explanation: z.string().describe("Markdown: why the answer is right and a common mistake to avoid"),
      }),
    )
    .describe("3 to 5 check-your-understanding questions"),
  keyPoints: z.array(z.string()).describe("3 to 6 short takeaways"),
  keyTerms: z.array(z.object({ term: z.string(), definition: z.string() })).describe("0 to 6 key terms"),
});

export type LessonContent = z.infer<typeof LessonContentSchema>;
export type LessonCheck = LessonContent["checks"][number];

/** Language a lesson is written in. Language subjects are taught in their own language. */
export function contentLocale(subjectId: string, uiLocale: string): "en" | "fr" | "mfe" {
  if (subjectId === "english" || subjectId === "english-literature") return "en";
  if (subjectId === "french" || subjectId === "french-literature") return "fr";
  if (subjectId === "kreol-morisien") return "mfe";
  return uiLocale === "fr" || uiLocale === "mfe" ? uiLocale : "en";
}
