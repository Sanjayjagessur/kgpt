/**
 * Tutor replies may contain two kinds of callout, written as Markdown blockquotes
 * whose first line is a fixed, language-independent marker:
 *
 *   > [!KEY]
 *   > $F = ma$: force = mass × acceleration
 *
 *   > [!CHECK]
 *   > Same force, double the mass: what happens to the acceleration?
 *
 * The markers never change with the reply language, so they work in English,
 * French and Kreol. A blockquote without a marker stays an ordinary blockquote.
 */

export type CalloutKind = "key" | "check";
export type AnswerSegment = { kind: "markdown" | CalloutKind; text: string };

const MARKER_LINE = /^\s{0,3}>\s?\[!(KEY|CHECK)\][ \t]*(.*)$/i;
const QUOTE_LINE = /^\s{0,3}>\s?(.*)$/;
const FENCE = /^\s{0,3}(```|~~~)/;

/** Splits a reply into Markdown and callout segments (safe to call on partial, streaming text). */
export function splitCallouts(markdown: string): AnswerSegment[] {
  const segments: AnswerSegment[] = [];
  const lines = markdown.split("\n");
  let plain: string[] = [];
  let inFence = false;

  const flushPlain = () => {
    const text = plain.join("\n");
    if (text.trim()) segments.push({ kind: "markdown", text });
    plain = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (FENCE.test(line)) inFence = !inFence;
    const marker = inFence ? null : MARKER_LINE.exec(line);
    if (!marker) {
      plain.push(line);
      continue;
    }
    flushPlain();
    const kind = marker[1].toUpperCase() === "KEY" ? "key" : "check";
    const body: string[] = marker[2].trim() ? [marker[2]] : [];
    while (i + 1 < lines.length) {
      const next = QUOTE_LINE.exec(lines[i + 1]);
      if (!next || MARKER_LINE.test(lines[i + 1])) break;
      body.push(next[1]);
      i++;
    }
    segments.push({ kind, text: body.join("\n").trim() });
  }
  flushPlain();
  return segments;
}

/** Removes the markers, keeping the content as plain blockquotes (for copy, notes and previews). */
export function stripCalloutMarkers(markdown: string): string {
  return markdown.replace(/\[!(KEY|CHECK)\][ \t]*/gi, "");
}
