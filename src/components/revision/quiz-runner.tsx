"use client";

import { Check, CircleAlert, ListChecks, Trophy, X } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useRef, useState, useTransition } from "react";
import { Markdown } from "@/components/common/markdown";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { QUIZ_LENGTH } from "@/lib/revision";
import { cn } from "@/lib/utils";
import { startQuiz, submitQuiz } from "@/server/actions/revision";

type Question = { question: string; options: string[] };
type Result = { correctOption: number; explanation: string };
type Quiz = { attemptId: number; questions: Question[] };

/**
 * Runs a quiz: questions are fetched without answers, marked on the server
 * on submit, then shown with the right answers and explanations.
 */
export function QuizRunner({
  unitId,
  bankSize,
  best,
  attempts,
  summaryHref,
  lang,
}: {
  unitId: string;
  bankSize: number;
  best: number | null;
  attempts: number;
  summaryHref: string;
  lang: string;
}) {
  const t = useTranslations("revision");
  const [quiz, setQuiz] = useState<Quiz | null>(null);
  const [answers, setAnswers] = useState<(number | null)[]>([]);
  const [results, setResults] = useState<{ correct: number; score: number; items: Result[] } | null>(null);
  const [error, setError] = useState<"start" | "submit" | null>(null);
  const [pending, startTransition] = useTransition();
  const topRef = useRef<HTMLDivElement>(null);

  function start() {
    setError(null);
    startTransition(async () => {
      const res = await startQuiz(unitId);
      if (!res.ok) return setError("start");
      setQuiz({ attemptId: res.attemptId, questions: res.questions });
      setAnswers(res.questions.map(() => null));
      setResults(null);
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
    });
  }

  function submit() {
    if (!quiz) return;
    setError(null);
    startTransition(async () => {
      const res = await submitQuiz({ attemptId: quiz.attemptId, answers });
      if (!res.ok) return setError("submit");
      setResults({ correct: res.correct, score: res.score, items: res.results });
      topRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
      topRef.current?.focus({ preventScroll: true });
    });
  }

  const unanswered = answers.filter((a) => a === null).length;

  return (
    <div ref={topRef} tabIndex={-1} className="scroll-mt-28 space-y-4 outline-none">
      {!quiz ? (
        <div className="rounded-xl bg-card p-5 shadow-sm sm:p-6">
          <div className="flex items-start gap-4">
            <span className="bg-subject-soft text-subject-ink flex size-12 shrink-0 items-center justify-center rounded-full">
              <ListChecks className="size-6" aria-hidden="true" />
            </span>
            <div>
              <h2 className="text-2xl font-bold">{t("quizTitle")}</h2>
              <p className="mt-1 text-muted-foreground">{t("quizBody", { count: Math.min(QUIZ_LENGTH, bankSize), bank: bankSize })}</p>
              {attempts > 0 && best != null && (
                <p className="mt-2 text-sm font-semibold">{t("quizHistory", { count: attempts, percent: Math.round(best) })}</p>
              )}
            </div>
          </div>
          <Button size="lg" className="mt-5" onClick={start} disabled={pending}>
            {pending ? t("starting") : t("startQuiz")}
          </Button>
        </div>
      ) : (
        <>
          {results && (
            <motion.div
              initial={{ scale: 0.96, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: "spring", stiffness: 400, damping: 26 }}
              role="status"
              className="flex flex-col gap-4 rounded-xl bg-card p-5 shadow-sm sm:flex-row sm:items-center"
            >
              <span className="flex size-14 shrink-0 items-center justify-center rounded-full bg-pollen/20 text-pollen">
                <Trophy className="size-7" aria-hidden="true" />
              </span>
              <div className="flex-1">
                <p className="font-heading text-2xl font-extrabold">
                  {t("quizScore", { correct: results.correct, total: quiz.questions.length })}
                </p>
                <p className="text-sm text-muted-foreground">
                  {results.score >= 80 ? t("quizGreat") : results.score >= 50 ? t("quizGood") : t("quizKeepGoing")}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <ButtonLink href={summaryHref} variant="ghost">
                  {t("reviewSummary")}
                </ButtonLink>
                <Button onClick={start} disabled={pending}>
                  {pending ? t("starting") : t("anotherQuiz")}
                </Button>
              </div>
            </motion.div>
          )}

          <ol lang={lang} className="space-y-4">
            {quiz.questions.map((q, i) => (
              <QuizQuestion
                key={`${quiz.attemptId}-${i}`}
                index={i}
                total={quiz.questions.length}
                question={q}
                choice={answers[i]}
                onChoose={(c) => setAnswers((prev) => prev.map((p, j) => (j === i ? c : p)))}
                result={results?.items[i] ?? null}
              />
            ))}
          </ol>

          {!results && (
            <div className="flex flex-col gap-3 rounded-xl bg-card p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between sm:p-5">
              <p className="text-sm text-muted-foreground" aria-live="polite">
                {unanswered > 0 ? t("unanswered", { count: unanswered }) : t("readyToSubmit")}
              </p>
              <Button size="lg" onClick={submit} disabled={pending || unanswered > 0} className="shrink-0">
                {pending ? t("marking") : t("submitQuiz")}
              </Button>
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="flex items-center gap-2 text-sm font-medium text-destructive">
          <CircleAlert className="size-4" aria-hidden="true" />
          {error === "start" ? t("startFailed") : t("submitFailed")}
        </p>
      )}
    </div>
  );
}

function QuizQuestion({
  index,
  total,
  question,
  choice,
  onChoose,
  result,
}: {
  index: number;
  total: number;
  question: Question;
  choice: number | null;
  onChoose: (choice: number) => void;
  result: Result | null;
}) {
  const t = useTranslations("revision");
  const tl = useTranslations("learn");
  const name = useId();
  const correct = result ? choice === result.correctOption : null;

  return (
    <li
      className={cn(
        "rounded-xl border-2 bg-card p-4 transition-colors sm:p-5",
        correct === true ? "border-success/50" : correct === false ? "border-flame/40" : "border-transparent shadow-sm",
      )}
    >
      <p className="mb-2 text-xs font-bold text-muted-foreground">{tl("questionN", { n: index + 1, total })}</p>
      <div id={`${name}-q`} className="mb-4">
        <Markdown className="font-semibold">{question.question}</Markdown>
      </div>
      <fieldset disabled={!!result} aria-labelledby={`${name}-q`}>
        <div className="grid gap-2">
          {question.options.map((option, i) => {
            const isCorrect = result !== null && i === result.correctOption;
            const isWrongPick = result !== null && !correct && i === choice;
            return (
              <label
                key={i}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  choice === i && !result ? "border-primary bg-secondary" : "border-border hover:border-input",
                  isCorrect && "border-success/60 bg-success/10",
                  isWrongPick && "border-flame/50 bg-flame/10",
                  result && "cursor-default",
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={i}
                  checked={choice === i}
                  onChange={() => onChoose(i)}
                  aria-labelledby={`${name}-letter-${i} ${name}-option-${i}`}
                  className="sr-only"
                />
                <span
                  id={`${name}-letter-${i}`}
                  className={cn(
                    "flex size-7 shrink-0 items-center justify-center rounded-full border-2 text-xs font-bold transition-colors",
                    choice === i ? "border-primary bg-primary text-primary-foreground" : "border-input text-muted-foreground",
                  )}
                >
                  {String.fromCharCode(65 + i)}
                </span>
                <span id={`${name}-option-${i}`} className="min-w-0 flex-1 pt-0.5">
                  <Markdown>{option}</Markdown>
                </span>
                {isCorrect && <Check className="mt-0.5 size-5 text-success" aria-label={tl("correct")} />}
              </label>
            );
          })}
        </div>
      </fieldset>
      {result && (
        <motion.div
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn("mt-4 rounded-lg p-3", correct ? "bg-success/10" : "bg-flame/10")}
        >
          <p className={cn("mb-1 flex items-center gap-1.5 text-sm font-bold", correct ? "text-success" : "text-flame-foreground")}>
            {correct ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
            {correct ? tl("correct") : t("correctWas", { letter: String.fromCharCode(65 + result.correctOption) })}
          </p>
          <Markdown className="text-sm">{result.explanation}</Markdown>
        </motion.div>
      )}
    </li>
  );
}
