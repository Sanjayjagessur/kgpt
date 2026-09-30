"use client";

import { CircleAlert, Monitor, Moon, Sun } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { useTheme } from "next-themes";
import { useId, useMemo, useState, useSyncExternalStore, useTransition } from "react";
import { toast } from "sonner";
import { LocaleChoice, SubjectStep } from "@/components/onboarding/onboarding-flow";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { siteConfig, type TutorLocale, type UiLocale } from "@/config/site";
import { GRADES, stageForGrade, subjectsForGrade, type SubjectId } from "@/config/subjects";
import { cn } from "@/lib/utils";
import { completeOnboarding } from "@/server/actions/profile";

type Values = {
  displayName: string;
  grade: number;
  subjects: SubjectId[];
  uiLocale: UiLocale;
  tutorLocale: TutorLocale;
};

const subscribeNoop = () => () => {};

/** Profile, subjects and language settings, saved together. Theme applies at once. */
export function SettingsForm({ initial }: { initial: Values }) {
  const t = useTranslations("settings");
  const to = useTranslations("onboarding");
  const tc = useTranslations("common");
  const tn = useTranslations("nav");
  const router = useRouter();
  const [values, setValues] = useState(initial);
  const [error, setError] = useState<"name" | "subjects" | "save" | null>(null);
  const [pending, startTransition] = useTransition();
  const { theme, setTheme } = useTheme();
  // The theme is only known in the browser.
  const mounted = useSyncExternalStore(subscribeNoop, () => true, () => false);
  const ids = { name: useId(), grade: useId(), theme: useId() };

  const available = useMemo(() => subjectsForGrade(values.grade).map((s) => s.id), [values.grade]);
  const dirty = JSON.stringify(values) !== JSON.stringify(initial);

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((v) => ({ ...v, [key]: value }));
    setError(null);
  }

  function changeGrade(grade: number) {
    // Keep the subjects that exist in the new grade.
    const next = new Set(subjectsForGrade(grade).map((s) => s.id));
    setValues((v) => ({ ...v, grade, subjects: v.subjects.filter((s) => next.has(s)) }));
    setError(null);
  }

  function save(e: { preventDefault(): void }) {
    e.preventDefault();
    if (!/^.{1,40}$/.test(values.displayName.trim())) return setError("name");
    if (values.subjects.length === 0) return setError("subjects");
    startTransition(async () => {
      const res = await completeOnboarding(values);
      if (!res.ok) return setError("save");
      toast.success(t("saved"));
      router.refresh();
    });
  }

  const themes = [
    { value: "light", label: tn("themeLight"), icon: Sun },
    { value: "dark", label: tn("themeDark"), icon: Moon },
    { value: "system", label: tn("themeSystem"), icon: Monitor },
  ];

  return (
    <form onSubmit={save} noValidate className="space-y-10">
      <section aria-labelledby="profile-title" className="space-y-5">
        <div>
          <h2 id="profile-title" className="text-xl font-bold">
            {t("profile")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("profileBody")}</p>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="grid content-start gap-1.5">
            <Label htmlFor={ids.name}>{to("nameLabel")}</Label>
            <Input
              id={ids.name}
              value={values.displayName}
              onChange={(e) => set("displayName", e.target.value)}
              maxLength={40}
              autoComplete="given-name"
              aria-invalid={error === "name" || undefined}
              aria-describedby={error === "name" ? `${ids.name}-error` : undefined}
            />
            {error === "name" && (
              <p id={`${ids.name}-error`} className="text-sm font-medium text-destructive">
                {to("errors.name")}
              </p>
            )}
          </div>
          <div className="grid content-start gap-1.5">
            <Label htmlFor={ids.grade}>{tc("gradeLabel")}</Label>
            <select
              id={ids.grade}
              value={values.grade}
              onChange={(e) => changeGrade(Number(e.target.value))}
              aria-describedby={`${ids.grade}-hint`}
              className="h-11 rounded-lg border border-input bg-card px-3 text-sm font-semibold outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50"
            >
              {GRADES.map((g) => (
                <option key={g} value={g}>
                  {tc("grade", { grade: g })} · {tc(`stage.${stageForGrade(g)}`)}
                </option>
              ))}
            </select>
            <p id={`${ids.grade}-hint`} className="text-xs text-muted-foreground">
              {t("gradeHint")}
            </p>
          </div>
        </div>
      </section>

      <section aria-labelledby="subjects-title" className="space-y-4">
        <div>
          <h2 id="subjects-title" className="text-xl font-bold">
            {t("subjects")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("subjectsBody")}</p>
        </div>
        <SubjectStep available={available} value={values.subjects} onChange={(s) => set("subjects", s)} />
        {error === "subjects" && (
          <p role="alert" className="text-sm font-medium text-destructive">
            {to("errors.subjects")}
          </p>
        )}
      </section>

      <section aria-labelledby="languages-title" className="space-y-5">
        <h2 id="languages-title" className="text-xl font-bold">
          {t("languages")}
        </h2>
        <LocaleChoice
          label={to("uiLanguage")}
          options={siteConfig.uiLocales}
          value={values.uiLocale}
          onChange={(v) => set("uiLocale", v)}
        />
        <LocaleChoice
          label={to("tutorLanguage")}
          options={siteConfig.tutorLocales}
          value={values.tutorLocale}
          onChange={(v) => set("tutorLocale", v)}
        />
      </section>

      <div className="sticky bottom-24 z-10 flex flex-wrap items-center gap-3 rounded-xl bg-card p-4 shadow-md md:bottom-4">
        <Button type="submit" size="lg" disabled={pending || !dirty}>
          {pending ? tc("saving") : t("save")}
        </Button>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          {dirty ? t("unsaved") : t("upToDate")}
        </p>
        {error === "save" && (
          <p role="alert" className="flex w-full items-center gap-2 text-sm font-medium text-destructive">
            <CircleAlert className="size-4" aria-hidden="true" />
            {to("errors.save")}
          </p>
        )}
      </div>

      <section aria-labelledby="appearance-title" className="space-y-4">
        <div>
          <h2 id="appearance-title" className="text-xl font-bold">
            {t("appearance")}
          </h2>
          <p className="text-sm text-muted-foreground">{t("appearanceBody")}</p>
        </div>
        <div role="radiogroup" aria-labelledby="appearance-title" className="grid gap-2 sm:grid-cols-3">
          {themes.map((o) => {
            const on = mounted && theme === o.value;
            return (
              <button
                key={o.value}
                type="button"
                role="radio"
                aria-checked={on}
                onClick={() => setTheme(o.value)}
                className={cn(
                  "flex items-center gap-3 rounded-lg border-2 bg-card px-4 py-3 text-left font-semibold transition-[border-color,background-color] duration-150",
                  on ? "border-primary bg-secondary" : "border-border hover:border-input",
                )}
              >
                <o.icon className="size-4" aria-hidden="true" />
                {o.label}
              </button>
            );
          })}
        </div>
      </section>
    </form>
  );
}
