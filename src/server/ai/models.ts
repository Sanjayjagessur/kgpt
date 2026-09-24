/** Claude models used by the platform (see docs/myKPT-cost-analysis.docx). */
export const MODELS = {
  /** Tutor replies, lesson content, marking. */
  main: "claude-sonnet-5",
  /** Safety screening and light tasks. */
  fast: "claude-haiku-4-5",
} as const;
