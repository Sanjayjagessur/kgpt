const SYMBOLS: Record<string, string> = {
  times: "×",
  div: "÷",
  cdot: "·",
  pm: "±",
  le: "≤",
  leq: "≤",
  ge: "≥",
  geq: "≥",
  ne: "≠",
  neq: "≠",
  approx: "≈",
  pi: "π",
  theta: "θ",
  alpha: "α",
  beta: "β",
  infty: "∞",
  rightarrow: "→",
  to: "→",
  cup: "∪",
  cap: "∩",
  in: "∈",
  circ: "°",
  sqrt: "√",
};

/** A one-line, readable preview of Markdown with LaTeX (for lists and search results). */
export function plainPreview(markdown: string, max = 180) {
  return markdown
    .replace(/\\(?:frac)\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\([a-zA-Z]+)/g, (_, cmd: string) => SYMBOLS[cmd] ?? "")
    .replace(/[{}$]/g, "")
    .replace(/[#*_>`|~]+/g, "")
    .replace(/^\s*[-+]\s+/gm, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, max);
}
