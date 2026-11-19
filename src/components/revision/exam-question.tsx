"use client";

import { Check, CircleAlert, Minus, RotateCcw, Target } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState } from "react";
import { EquationInput } from "@/components/chat/equation-input";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { MAX_EXAM_ANSWER, type ExamFeedback, type ExamQuestionView } from "@/lib/revision";
import { cn } from "@/lib/utils";

type Marked = { answer: string; awarded: number; feedback: ExamFeedback };
type ErrorCode = "rate_limited" | "plan_required" | "unsafe" | "support" | "failed";

/** One exam-style question: write an answer, have it marked against the mark scheme, see the feedback. */
export function ExamQuestion({ question, total }: { question: ExamQuestionView; total: number }) {
  const t = useTranslations("revision");
  const [answer, setAnswer] = useState("");
  const [marked, setMarked] = useState<Marked | null>(question.last);
  const [marking, setMarking] = useState(false);
  const [error, setError] = useState<ErrorCode | null>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLDivElement>(null);
  const id = useId();

  async function mark() {
    const text = answer.trim();
    if (!text || marking) return;
    setMarking(true);
    setError(null);
    try {
      const res = await fetch(`/api/revision/exam/${question.id}/mark`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answer: text }),
      });
      const data = await res.json().catch(() => null);
      if (!res.ok || !data) {
        const code = data?.error;
        setError(res.status === 429 ? "rate_limited" : res.status === 402 ? "plan_required" : code === "unsafe" || code === "support" ? code : "failed");
        return;
      }
      setMarked({ answer: text, awarded: data.awarded, feedback: data.feedback });
      requestAnimationFrame(() => resultRef.current?.focus());
    } catch {
      setError("failed");
    } finally {
      setMarking(false);
    }
  }

  function tryAgain() {
    // Start from the previous answer so it can be improved.
    setAnswer(marked?.answer ?? "");
    setMarked(null);
    requestAnimationFrame(() => textareaRef.current?.focus());
  }

  function insertEquation(latex: string) {
    const el = textareaRef.current;
    const start = el?.selectionStart ?? answer.length;
    const end = el?.selectionEnd ?? answer.length;
    const snippet = `$${latex}$`;
    setAnswer(answer.slice(0, start) + snippet + answer.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      el?.setSelectionRange(start + snippet.length, start + snippet.length);
    });
  }

  const full = marked ? marked.awarded === question.marks : false;

  return (
    <article aria-labelledby={`${id}-title`} className="rounded-xl bg-card p-4 shadow-sm sm:p-6">
      <header className="mb-3 flex items-center justify-between gap-3">
        <h3 id={`${id}-title`} className="text-sm font-bold text-muted-foreground">
          {t("examQuestionN", { n: question.position, total })}
        </h3>
        <span className="bg-subject-soft text-subject-ink rounded-full px-2.5 py-0.5 text-xs font-bold">
          {t("marks", { count: question.marks })}
        </span>
      </header>
      <Markdown className="font-medium">{question.prompt}</Markdown>

      {!marked ? (
        <div className="mt-5">
          <div className="mb-2 flex items-end justify-between gap-2">
            <Label htmlFor={`${id}-answer`}>{t("yourAnswer")}</Label>
            <EquationInput onInsert={insertEquation} disabled={marking} />
          </div>
          <Textarea
            ref={textareaRef}
            id={`${id}-answer`}
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
            rows={question.marks >= 5 ? 8 : 4}
            maxLength={MAX_EXAM_ANSWER}
            readOnly={marking}
            aria-describedby={`${id}-hint`}
          />
          <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
            {t("answerHint")}
          </p>
          <Button className="mt-4" onClick={mark} disabled={marking || !answer.trim()}>
            <Target aria-hidden="true" />
            {marking ? t("markingAnswer") : t("markAnswer")}
          </Button>
          {error && (
            <p role="alert" className="mt-3 flex items-start gap-2 text-sm font-medium text-destructive">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {t(`markError.${error}`)}
            </p>
          )}
        </div>
      ) : (
        <motion.div
          ref={resultRef}
          tabIndex={-1}
          initial={{ opacity: 0, y: 6 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="mt-5 space-y-4 outline-none"
        >
          <div className={cn("flex items-center gap-4 rounded-lg p-4", full ? "bg-success/10" : "bg-sunken")}>
            <p className="font-heading text-3xl font-extrabold tabular-nums">
              {marked.awarded}
              <span className="text-lg text-muted-foreground">/{question.marks}</span>
            </p>
            <div className="min-w-0 flex-1">
              <p className="sr-only">{t("marksAwarded", { awarded: marked.awarded, marks: question.marks })}</p>
              <Markdown className="text-sm">{marked.feedback.summary}</Markdown>
            </div>
          </div>

          <details className="group rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">{t("yourAnswerWas")}</summary>
            <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground">{marked.answer}</p>
          </details>

          <div>
            <h4 className="mb-2 text-sm font-bold">{t("markSchemeTitle")}</h4>
            <ul className="space-y-2">
              {marked.feedback.points.map((p, i) => {
                const got = p.awarded >= p.marks;
                return (
                  <li key={i} className="flex gap-3 rounded-lg border p-3">
                    <span
                      className={cn(
                        "mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-full",
                        got ? "bg-success/15 text-success" : p.awarded > 0 ? "bg-pollen/20 text-foreground" : "bg-muted text-muted-foreground",
                      )}
                    >
                      {got ? <Check className="size-3.5" strokeWidth={3} aria-hidden="true" /> : <Minus className="size-3.5" aria-hidden="true" />}
                    </span>
                    <div className="min-w-0 flex-1 text-sm">
                      <div className="flex items-start justify-between gap-3">
                        <Markdown className="text-sm font-semibold">{p.point}</Markdown>
                        <span className="shrink-0 font-bold text-muted-foreground tabular-nums">
                          {t("pointMarks", { awarded: p.awarded, marks: p.marks })}
                        </span>
                      </div>
                      {p.comment && <Markdown className="mt-0.5 text-sm text-muted-foreground">{p.comment}</Markdown>}
                    </div>
                  </li>
                );
              })}
            </ul>
          </div>

          {marked.feedback.nextStep && (
            <div className="rounded-lg bg-secondary p-3 text-secondary-foreground">
              <p className="mb-0.5 text-xs font-bold">{t("nextStep")}</p>
              <Markdown className="text-sm">{marked.feedback.nextStep}</Markdown>
            </div>
          )}

          <details className="rounded-lg border p-3">
            <summary className="cursor-pointer text-sm font-semibold">{t("modelAnswer")}</summary>
            <Markdown className="mt-2 text-sm">{question.modelAnswer}</Markdown>
          </details>

          <Button variant="outline" onClick={tryAgain}>
            <RotateCcw aria-hidden="true" />
            {t("tryAgain")}
          </Button>
        </motion.div>
      )}
    </article>
  );
}
