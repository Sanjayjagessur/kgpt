"use client";

import { Check, CircleAlert } from "lucide-react";
import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState, useTransition } from "react";
import { ReefLine } from "@/components/common/reef-line";
import { SubjectArt } from "@/components/common/subject-art";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig, type TutorLocale, type UiLocale } from "@/config/site";
import { GRADES, stageForGrade, subjectStyle, subjectsForGrade, type SubjectId } from "@/config/subjects";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/actions/profile";

type State = {
  displayName: string;
  grade: number | null;
  subjects: SubjectId[];
  uiLocale: UiLocale;
  tutorLocale: TutorLocale;
};

const STEPS = ["name", "grade", "subjects", "language"] as const;
type ErrorKey = "name" | "grade" | "subjects" | "save";

const COPY = {
  name: { title: "nameTitle", body: "nameBody" },
  grade: { title: "gradeTitle", body: "gradeBody" },
  subjects: { title: "subjectsTitle", body: "subjectsBody" },
  language: { title: "languageTitle", body: "languageBody" },
} as const;

export function OnboardingFlow({ initial }: { initial: State }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [state, setState] = useState<State>(initial);
  const [error, setError] = useState<ErrorKey | null>(null);
  const [pending, startTransition] = useTransition();
  const headingRef = useRef<HTMLHeadingElement>(null);

  const available = useMemo(() => (state.grade ? subjectsForGrade(state.grade).map((s) => s.id) : []), [state.grade]);

  const current = STEPS[step];
  const isLast = step === STEPS.length - 1;

  function validate(): ErrorKey | null {
    if (current === "name" && !/^.{1,40}$/.test(state.displayName.trim())) return "name";
    if (current === "grade" && !state.grade) return "grade";
    if (current === "subjects" && state.subjects.length === 0) return "subjects";
    return null;
  }

  function go(delta: number) {
    if (delta > 0) {
      const problem = validate();
      if (problem) {
        setError(problem);
        return;
      }
    }
    setError(null);
    setDirection(delta);
    setStep((s) => s + delta);
    // Move focus to the new step heading for keyboard and screen reader users.
    setTimeout(() => headingRef.current?.focus(), 260);
  }

  function finish() {
    startTransition(async () => {
      const res = await completeOnboarding({ ...state, grade: state.grade ?? 0 });
      if (!res.ok) {
        setError("save");
        return;
      }
      router.replace("/learn");
      router.refresh();
    });
  }

  function chooseGrade(grade: number) {
    setState((s) => ({
      ...s,
      grade,
      // A new grade pre-selects every subject it offers; students then trim the list.
      subjects: s.grade === grade ? s.subjects : subjectsForGrade(grade).map((x) => x.id),
    }));
    setError(null);
  }

  return (
    <div className="flex flex-1 flex-col">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex flex-1 gap-1.5" aria-hidden="true">
          {STEPS.map((s, i) => (
            <span
              key={s}
              className={cn(
                "h-1.5 flex-1 rounded-full transition-colors duration-300",
                i <= step ? "bg-primary" : "bg-border",
              )}
            />
          ))}
        </div>
        <p className="text-xs font-semibold text-muted-foreground">
          {t("step", { current: step + 1, total: STEPS.length })}
        </p>
      </div>

      <AnimatePresence mode="wait" initial={false} custom={direction}>
        <motion.section
          key={current}
          initial={{ opacity: 0, x: direction * 24 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: direction * -24 }}
          transition={{ duration: 0.22, ease: [0.22, 1, 0.36, 1] }}
          className="flex-1"
          aria-labelledby="onboarding-heading"
        >
          <h1
            id="onboarding-heading"
            ref={headingRef}
            tabIndex={-1}
            className="text-3xl font-extrabold outline-none sm:text-4xl"
          >
            {t(COPY[current].title)}
          </h1>
          <ReefLine className="mt-3 mb-4" />
          <p className="mb-8 text-muted-foreground">{t(COPY[current].body)}</p>

          {current === "name" && (
            <NameStep
              value={state.displayName}
              invalid={error === "name"}
              onChange={(displayName) => setState((s) => ({ ...s, displayName }))}
              onSubmit={() => go(1)}
            />
          )}
          {current === "grade" && <GradeStep value={state.grade} onChange={chooseGrade} />}
          {current === "subjects" && (
            <SubjectStep
              available={available}
              value={state.subjects}
              onChange={(subjects) => {
                setState((s) => ({ ...s, subjects }));
                if (subjects.length) setError(null);
              }}
            />
          )}
          {current === "language" && (
            <div className="space-y-8">
              <LocaleChoice
                label={t("uiLanguage")}
                options={siteConfig.uiLocales}
                value={state.uiLocale}
                onChange={(uiLocale) => setState((s) => ({ ...s, uiLocale }))}
              />
              <LocaleChoice
                label={t("tutorLanguage")}
                options={siteConfig.tutorLocales}
                value={state.tutorLocale}
                onChange={(tutorLocale) => setState((s) => ({ ...s, tutorLocale }))}
              />
            </div>
          )}
        </motion.section>
      </AnimatePresence>

      <div aria-live="assertive">
        {error && (
          <p role="alert" className="mt-6 flex items-center gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
            {t(`errors.${error}`)}
          </p>
        )}
      </div>

      <div className="sticky bottom-0 mt-8 flex gap-3 border-t border-transparent bg-background/90 pt-4 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur">
        {step > 0 && (
          <Button variant="ghost" size="lg" onClick={() => go(-1)} disabled={pending}>
            {tc("back")}
          </Button>
        )}
        <Button size="lg" className="ml-auto min-w-40" onClick={isLast ? finish : () => go(1)} disabled={pending}>
          {isLast ? (pending ? t("finishing") : t("finish")) : tc("continue")}
        </Button>
      </div>
    </div>
  );
}

function NameStep({
  value,
  invalid,
  onChange,
  onSubmit,
}: {
  value: string;
  invalid: boolean;
  onChange: (v: string) => void;
  onSubmit: () => void;
}) {
  const t = useTranslations("onboarding");
  const id = useId();
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        onSubmit();
      }}
      className="max-w-sm space-y-2"
    >
      <Label htmlFor={id}>{t("nameLabel")}</Label>
      <Input
        id={id}
        value={value}
        maxLength={40}
        autoComplete="nickname"
        placeholder={t("namePlaceholder")}
        aria-invalid={invalid || undefined}
        onChange={(e) => onChange(e.target.value)}
      />
    </form>
  );
}

function GradeStep({ value, onChange }: { value: number | null; onChange: (g: number) => void }) {
  const t = useTranslations("onboarding");
  const tc = useTranslations("common");
  return (
    <div role="radiogroup" aria-label={t("gradeTitle")} className="grid grid-cols-2 gap-3 sm:grid-cols-4">
      {GRADES.map((g) => {
        const selected = value === g;
        return (
          <button
            key={g}
            type="button"
            role="radio"
            aria-checked={selected}
            aria-label={`${tc("grade", { grade: g })}, ${tc(`stage.${stageForGrade(g)}`)}`}
            onClick={() => onChange(g)}
            className={cn(
              "relative flex flex-col items-start rounded-lg border-2 bg-card p-4 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.97] motion-reduce:active:scale-100",
              selected ? "border-primary bg-secondary" : "border-border hover:border-input",
            )}
          >
            <span className="text-2xs font-semibold text-muted-foreground">{tc("gradeLabel")}</span>
            <span className="font-heading text-4xl font-extrabold tabular-nums">{g}</span>
            <span className="text-xs font-semibold text-muted-foreground">{tc(`stage.${stageForGrade(g)}`)}</span>
            {selected && <Check className="absolute top-3 right-3 size-5 text-primary" aria-hidden="true" />}
          </button>
        );
      })}
    </div>
  );
}

function SubjectStep({
  available,
  value,
  onChange,
}: {
  available: SubjectId[];
  value: SubjectId[];
  onChange: (v: SubjectId[]) => void;
}) {
  const t = useTranslations("onboarding");
  const ts = useTranslations("subjects");
  const selected = new Set(value);
  const toggle = (id: SubjectId) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    onChange(available.filter((s) => next.has(s)));
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="text-sm font-semibold" aria-live="polite">
          {t("subjectsCount", { count: value.length })}
        </p>
        <div className="flex gap-1">
          <Button variant="ghost" size="sm" onClick={() => onChange(available)}>
            {t("selectAll")}
          </Button>
          <Button variant="ghost" size="sm" onClick={() => onChange([])}>
            {t("clearAll")}
          </Button>
        </div>
      </div>
      <ul className="grid grid-cols-1 gap-2.5 sm:grid-cols-2">
        {available.map((id) => {
          const on = selected.has(id);
          return (
            <li key={id} style={subjectStyle(id)}>
              <button
                type="button"
                role="checkbox"
                aria-checked={on}
                onClick={() => toggle(id)}
                className={cn(
                  "flex w-full items-center gap-3 rounded-lg border-2 p-2.5 text-left transition-[border-color,background-color,transform] duration-150 active:scale-[0.98] motion-reduce:active:scale-100",
                  on ? "border-subject bg-subject-tint" : "border-border bg-card hover:border-input",
                )}
              >
                <span className="bg-subject-soft flex size-12 shrink-0 items-center justify-center rounded-md">
                  <SubjectArt subject={id} className="w-10" />
                </span>
                <span className="flex-1 text-sm font-semibold">{ts(id)}</span>
                <span
                  aria-hidden="true"
                  className={cn(
                    "flex size-6 items-center justify-center rounded-full border-2 transition-colors",
                    on ? "bg-subject border-transparent text-card" : "border-input",
                  )}
                >
                  {on && <Check className="size-4" strokeWidth={3} />}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

function LocaleChoice<T extends "en" | "fr" | "mfe">({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: readonly T[];
  value: T;
  onChange: (v: T) => void;
}) {
  const tl = useTranslations("languages");
  const id = useId();
  return (
    <div>
      <p id={id} className="mb-3 text-sm font-semibold">
        {label}
      </p>
      <div role="radiogroup" aria-labelledby={id} className="grid gap-2 sm:grid-cols-3">
        {options.map((o) => (
          <button
            key={o}
            type="button"
            role="radio"
            aria-checked={value === o}
            onClick={() => onChange(o)}
            className={cn(
              "flex items-center justify-between rounded-lg border-2 bg-card px-4 py-3 text-left font-semibold transition-[border-color,background-color] duration-150",
              value === o ? "border-primary bg-secondary" : "border-border hover:border-input",
            )}
          >
            <span lang={o}>{{ en: tl("en"), fr: tl("fr"), mfe: tl("mfe") }[o]}</span>
            {value === o && <Check className="size-4 text-primary" aria-hidden="true" />}
          </button>
        ))}
      </div>
    </div>
  );
}
