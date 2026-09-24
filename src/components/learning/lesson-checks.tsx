"use client";

import { Check, CheckCircle2, CircleAlert, PartyPopper, X } from "lucide-react";
import { motion } from "motion/react";
import { useTranslations } from "next-intl";
import { useId, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { ButtonLink } from "@/components/ui/button-link";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { completeLesson } from "@/server/actions/progress";

export type RenderedCheck = {
  kind: "multiple_choice" | "short_answer";
  question: React.ReactNode;
  options: React.ReactNode[];
  correctOption: number;
  modelAnswer: React.ReactNode;
  explanation: React.ReactNode;
};

type Result = "correct" | "incorrect" | null;
/** What is sent to the server: chosen option index, or self-assessment for short answers. */
type Answer = number | boolean | null;

export function LessonChecks({
  lessonId,
  checks,
  alreadyCompleted,
  nextHref,
  unitHref,
}: {
  lessonId: string;
  checks: RenderedCheck[];
  alreadyCompleted: boolean;
  nextHref: string | null;
  unitHref: string;
}) {
  const t = useTranslations("learn");
  const [results, setResults] = useState<Result[]>(() => checks.map(() => null));
  const [answers, setAnswers] = useState<Answer[]>(() => checks.map(() => null));
  const [completed, setCompleted] = useState(false);
  const [failed, setFailed] = useState(false);
  const [pending, startTransition] = useTransition();

  const answered = results.filter((r) => r !== null).length;
  const correct = results.filter((r) => r === "correct").length;
  const allAnswered = answered === checks.length;

  function record(i: number, r: Result, answer: Answer) {
    setResults((prev) => prev.map((p, j) => (j === i ? r : p)));
    setAnswers((prev) => prev.map((p, j) => (j === i ? answer : p)));
  }

  function finish() {
    setFailed(false);
    startTransition(async () => {
      // The server marks the answers against the stored lesson.
      const res = await completeLesson({ lessonId, answers });
      if (!res.ok) {
        setFailed(true);
        return;
      }
      setCompleted(true);
    });
  }

  return (
    <section aria-labelledby="checks-title" className="space-y-4">
      <div className="flex items-end justify-between gap-3">
        <h2 id="checks-title" className="text-2xl font-bold">
          {t("checkTitle")}
        </h2>
        {answered > 0 && (
          <p className="text-sm font-semibold text-muted-foreground" aria-live="polite">
            {t("checkScore", { correct, total: checks.length })}
          </p>
        )}
      </div>

      {checks.map((check, i) =>
        check.kind === "multiple_choice" && check.options.length > 1 ? (
          <MultipleChoice key={i} index={i} total={checks.length} check={check} onResult={(r, a) => record(i, r, a)} />
        ) : (
          <ShortAnswer key={i} index={i} total={checks.length} check={check} onResult={(r, a) => record(i, r, a)} />
        ),
      )}

      <div className="rounded-xl bg-card p-4 shadow-sm sm:p-5" aria-live="polite">
        {/* Done: show next steps. A returning student who re-answers every question can save the new score. */}
        {completed || (alreadyCompleted && !allAnswered) ? (
          <motion.div
            initial={completed ? { scale: 0.96, opacity: 0 } : false}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: "spring", stiffness: 400, damping: 26 }}
            className="flex flex-col gap-4 sm:flex-row sm:items-center"
          >
            <span className="flex size-12 shrink-0 items-center justify-center rounded-full bg-pollen/20 text-pollen">
              {completed ? <PartyPopper className="size-6" aria-hidden="true" /> : <CheckCircle2 className="size-6" aria-hidden="true" />}
            </span>
            <div className="flex-1">
              <p className="font-bold">{t("completed")}</p>
              <p className="text-sm text-muted-foreground">{nextHref ? t("completedBody") : t("unitDone")}</p>
            </div>
            <div className="flex gap-2">
              <ButtonLink href={unitHref} variant="ghost">
                {t("backToUnit")}
              </ButtonLink>
              {nextHref && <ButtonLink href={nextHref}>{t("nextLesson")}</ButtonLink>}
            </div>
          </motion.div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-muted-foreground">{allAnswered ? t("completedBody") : t("markCompleteHint")}</p>
            <Button size="lg" onClick={finish} disabled={pending} className="shrink-0">
              {pending ? t("saving") : t("markComplete")}
            </Button>
          </div>
        )}
        {failed && (
          <p role="alert" className="mt-3 flex items-center gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" aria-hidden="true" />
            {t("completeFailed")}
          </p>
        )}
      </div>
    </section>
  );
}

function QuestionShell({
  index,
  total,
  result,
  children,
  question,
}: {
  index: number;
  total: number;
  result: Result;
  children: React.ReactNode;
  question: React.ReactNode;
}) {
  const t = useTranslations("learn");
  return (
    <article
      className={cn(
        "rounded-xl border-2 bg-card p-4 transition-colors sm:p-5",
        result === "correct" ? "border-success/50" : result === "incorrect" ? "border-flame/40" : "border-transparent shadow-sm",
      )}
    >
      <p className="mb-2 text-xs font-bold text-muted-foreground">{t("questionN", { n: index + 1, total })}</p>
      <div className="mb-4 font-semibold">{question}</div>
      {children}
    </article>
  );
}

function Feedback({ result, explanation }: { result: Exclude<Result, null>; explanation: React.ReactNode }) {
  const t = useTranslations("learn");
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn("mt-4 rounded-lg p-3", result === "correct" ? "bg-success/10" : "bg-flame/10")}
    >
      <p className={cn("mb-1 flex items-center gap-1.5 text-sm font-bold", result === "correct" ? "text-success" : "text-flame-foreground")}>
        {result === "correct" ? <Check className="size-4" aria-hidden="true" /> : <X className="size-4" aria-hidden="true" />}
        {result === "correct" ? t("correct") : t("notQuite")}
      </p>
      {explanation}
    </motion.div>
  );
}

function MultipleChoice({
  index,
  total,
  check,
  onResult,
}: {
  index: number;
  total: number;
  check: RenderedCheck;
  onResult: (r: Result, answer: Answer) => void;
}) {
  const t = useTranslations("learn");
  const [choice, setChoice] = useState<number | null>(null);
  const [result, setResult] = useState<Result>(null);
  const name = useId();

  function submit() {
    if (choice === null) return;
    const r: Result = choice === check.correctOption ? "correct" : "incorrect";
    setResult(r);
    onResult(r, choice);
  }

  return (
    <QuestionShell index={index} total={total} result={result} question={check.question}>
      <fieldset disabled={result !== null}>
        <legend className="sr-only">{t("questionN", { n: index + 1, total })}</legend>
        <div className="grid gap-2">
          {check.options.map((option, i) => {
            const isCorrect = result !== null && i === check.correctOption;
            const isWrongPick = result === "incorrect" && i === choice;
            return (
              <label
                key={i}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-lg border-2 p-3 transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                  choice === i && result === null ? "border-primary bg-secondary" : "border-border hover:border-input",
                  isCorrect && "border-success/60 bg-success/10",
                  isWrongPick && "border-flame/50 bg-flame/10",
                  result !== null && "cursor-default",
                )}
              >
                <input
                  type="radio"
                  name={name}
                  value={i}
                  checked={choice === i}
                  onChange={() => setChoice(i)}
                  aria-labelledby={`${name}-letter-${i} ${name}-option-${i}`}
                  className="sr-only"
                />
                {/* Option letter: a visible handle for each choice and a name for maths-only options. */}
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
                  {option}
                </span>
                {isCorrect && <Check className="mt-0.5 size-5 text-success" aria-label={t("correct")} />}
              </label>
            );
          })}
        </div>
      </fieldset>
      {result === null ? (
        <Button className="mt-4" onClick={submit} disabled={choice === null}>
          {t("checkAnswer")}
        </Button>
      ) : (
        <Feedback result={result} explanation={check.explanation} />
      )}
    </QuestionShell>
  );
}

function ShortAnswer({
  index,
  total,
  check,
  onResult,
}: {
  index: number;
  total: number;
  check: RenderedCheck;
  onResult: (r: Result, answer: Answer) => void;
}) {
  const t = useTranslations("learn");
  const [text, setText] = useState("");
  const [revealed, setRevealed] = useState(false);
  const [result, setResult] = useState<Result>(null);
  const id = useId();

  function assess(r: Exclude<Result, null>) {
    setResult(r);
    onResult(r, r === "correct");
  }

  return (
    <QuestionShell index={index} total={total} result={result} question={check.question}>
      <Label htmlFor={id} className="mb-2">
        {t("yourAnswer")}
      </Label>
      <Textarea
        id={id}
        value={text}
        onChange={(e) => setText(e.target.value)}
        rows={3}
        maxLength={2000}
        readOnly={revealed}
        aria-describedby={`${id}-hint`}
      />
      <p id={`${id}-hint`} className="mt-1.5 text-xs text-muted-foreground">
        {t("yourAnswerHint")}
      </p>
      {!revealed ? (
        <Button className="mt-4" variant="outline" onClick={() => setRevealed(true)}>
          {t("showAnswer")}
        </Button>
      ) : (
        <motion.div initial={{ opacity: 0, y: 4 }} animate={{ opacity: 1, y: 0 }} className="mt-4 space-y-3">
          <div className="rounded-lg bg-sunken p-3">
            <p className="mb-1 text-xs font-bold">{t("modelAnswer")}</p>
            {check.modelAnswer}
          </div>
          {result === null ? (
            <div>
              <p className="mb-2 text-sm font-semibold">{t("selfAssess")}</p>
              <div className="flex gap-2">
                <Button variant="outline" onClick={() => assess("correct")}>
                  {t("gotIt")}
                </Button>
                <Button variant="ghost" onClick={() => assess("incorrect")}>
                  {t("notYet")}
                </Button>
              </div>
            </div>
          ) : (
            <Feedback result={result} explanation={check.explanation} />
          )}
        </motion.div>
      )}
    </QuestionShell>
  );
}
