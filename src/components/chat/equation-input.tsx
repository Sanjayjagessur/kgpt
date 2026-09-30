"use client";

import katex from "katex";
import { Sigma } from "lucide-react";
import { useTranslations } from "next-intl";
import { useId, useMemo, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

/** Snippets inserted at the cursor. `|` marks where the cursor goes next. */
const SNIPPETS: { label: string; latex: string }[] = [
  { label: "\\frac{a}{b}", latex: "\\frac{|}{}" },
  { label: "x^{n}", latex: "^{|}" },
  { label: "x_{n}", latex: "_{|}" },
  { label: "\\sqrt{x}", latex: "\\sqrt{|}" },
  { label: "\\sqrt[n]{x}", latex: "\\sqrt[|]{}" },
  { label: "\\times", latex: "\\times |" },
  { label: "\\div", latex: "\\div |" },
  { label: "\\pm", latex: "\\pm |" },
  { label: "\\le", latex: "\\le |" },
  { label: "\\ge", latex: "\\ge |" },
  { label: "\\ne", latex: "\\ne |" },
  { label: "\\approx", latex: "\\approx |" },
  { label: "\\pi", latex: "\\pi |" },
  { label: "\\theta", latex: "\\theta |" },
  { label: "\\degree", latex: "^\\circ |" },
  { label: "\\sin", latex: "\\sin(|)" },
  { label: "\\cos", latex: "\\cos(|)" },
  { label: "\\tan", latex: "\\tan(|)" },
  { label: "\\log", latex: "\\log(|)" },
  { label: "\\int", latex: "\\int |\\,dx" },
  { label: "\\sum", latex: "\\sum_{i=1}^{n} |" },
  { label: "\\vec{v}", latex: "\\vec{|}" },
  { label: "\\rightarrow", latex: "\\rightarrow |" },
  { label: "\\infty", latex: "\\infty |" },
];

function render(latex: string) {
  return katex.renderToString(latex, { throwOnError: false, strict: "ignore", output: "html" });
}

/**
 * The "fx" button: build an equation with buttons or LaTeX and see it rendered
 * before inserting it into the message as $...$.
 */
export function EquationInput({ onInsert, disabled }: { onInsert: (latex: string) => void; disabled?: boolean }) {
  const t = useTranslations("chat");
  const [open, setOpen] = useState(false);
  const [value, setValue] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();
  const previewId = useId();
  const preview = useMemo(() => (value.trim() ? render(value) : ""), [value]);
  const buttons = useMemo(() => SNIPPETS.map((s) => ({ ...s, html: render(s.label) })), []);

  const insertSnippet = (snippet: string) => {
    const el = inputRef.current;
    const start = el?.selectionStart ?? value.length;
    const end = el?.selectionEnd ?? value.length;
    const caret = snippet.indexOf("|");
    const clean = snippet.replace("|", "");
    setValue(value.slice(0, start) + clean + value.slice(end));
    requestAnimationFrame(() => {
      el?.focus();
      const pos = start + (caret === -1 ? clean.length : caret);
      el?.setSelectionRange(pos, pos);
    });
  };

  const submit = () => {
    if (!value.trim()) return;
    onInsert(value.trim());
    setValue("");
    setOpen(false);
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={<Button variant="ghost" size="icon" disabled={disabled} aria-label={t("equation")} />}
      >
        <Sigma aria-hidden="true" />
      </PopoverTrigger>
      <PopoverContent side="top" align="start" className="w-[min(22rem,calc(100vw-2rem))] gap-3 p-3">
        <p className="font-heading text-sm font-bold">{t("equationTitle")}</p>
        <div role="group" aria-label={t("equationSymbols")} className="grid grid-cols-6 gap-1">
          {buttons.map((s) => (
            <button
              key={s.label}
              type="button"
              onClick={() => insertSnippet(s.latex)}
              aria-label={s.label.replace(/\\/g, "")}
              className="flex h-10 items-center justify-center overflow-hidden rounded-md border bg-background text-sm transition-colors hover:bg-muted focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span aria-hidden="true" dangerouslySetInnerHTML={{ __html: s.html }} />
            </button>
          ))}
        </div>
        <div className="grid gap-1.5">
          <label htmlFor={inputId} className="text-xs font-semibold text-muted-foreground">
            {t("equationLatex")}
          </label>
          <input
            ref={inputRef}
            id={inputId}
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                submit();
              }
            }}
            aria-describedby={previewId}
            spellCheck={false}
            autoCapitalize="off"
            autoComplete="off"
            placeholder="x = \frac{-b \pm \sqrt{b^2-4ac}}{2a}"
            className="h-11 w-full rounded-lg border border-input bg-transparent px-2.5 font-mono text-sm outline-none focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 dark:bg-input/30"
          />
        </div>
        <div
          id={previewId}
          aria-live="polite"
          className="flex min-h-14 items-center justify-center overflow-x-auto rounded-lg bg-sunken px-3 py-2 text-lg"
        >
          {preview ? (
            <span dangerouslySetInnerHTML={{ __html: preview }} />
          ) : (
            <span className="text-sm text-muted-foreground">{t("equationPreview")}</span>
          )}
        </div>
        <Button onClick={submit} disabled={!value.trim()}>
          {t("equationInsert")}
        </Button>
      </PopoverContent>
    </Popover>
  );
}
