/**
 * Streams a tutor reply to the student one checked piece at a time.
 * Pure logic (no I/O) so it can be tested without the AI or database.
 */
/** Smallest piece of a reply checked on its own; the first piece is shorter so text appears quickly. */
const FIRST_CHUNK_CHARS = 240;
const CHUNK_CHARS = 700;

/**
 * Holds a streaming tutor reply back one paragraph at a time and releases each
 * paragraph only after it passes moderation. Checks run while the model keeps
 * writing, so the delay is roughly one classifier call, not the whole reply.
 */
export class OutputGuard {
  private pending = "";
  private chain: Promise<void> = Promise.resolve();
  private chunks = 0;
  /** Text the student has actually been sent. */
  released = "";
  /** Set when a paragraph failed moderation; nothing after it is released. */
  blocked: string | null = null;

  private readonly emit: (text: string) => void;
  private readonly onBlocked: (category: string) => void;
  private readonly check: (text: string) => Promise<string | null>;

  /**
   * @param check resolves to the blocking category for a piece of text, or null when it is safe.
   */
  constructor(
    emit: (text: string) => void,
    onBlocked: (category: string) => void,
    check: (text: string) => Promise<string | null>,
  ) {
    this.emit = emit;
    this.onBlocked = onBlocked;
    this.check = check;
  }

  push(delta: string) {
    if (this.blocked) return;
    this.pending += delta;
    const min = this.chunks === 0 ? FIRST_CHUNK_CHARS : CHUNK_CHARS;
    if (this.pending.length < min) return;
    const cut = cutPoint(this.pending, min);
    if (cut <= 0) return;
    this.enqueue(this.pending.slice(0, cut));
    this.pending = this.pending.slice(cut);
  }

  /** Releases whatever is left and waits for every check to finish. */
  async finish() {
    if (this.pending && !this.blocked) this.enqueue(this.pending);
    this.pending = "";
    await this.chain;
  }

  private enqueue(text: string) {
    this.chunks++;
    const verdict = this.check(text);
    this.chain = this.chain.then(async () => {
      if (this.blocked) return;
      const category = await verdict;
      if (category) {
        this.blocked = category;
        this.onBlocked(category);
        return;
      }
      this.released += text;
      this.emit(text);
    });
  }
}

/**
 * Where to end the next checked piece (exclusive index), or 0 to keep waiting.
 * Prefers whole paragraphs, then whole lines; for long unbroken text (essays,
 * long Kreol answers) a sentence end; and past a hard cap, the last space.
 */
export function cutPoint(text: string, min: number): number {
  const lastAfter = (re: RegExp) => {
    let at = -1;
    for (const m of text.matchAll(re)) at = m.index + m[0].length;
    return at;
  };
  const paragraph = text.lastIndexOf("\n\n");
  if (paragraph >= min / 2) return paragraph + 2;
  const line = text.lastIndexOf("\n");
  if (line >= min / 2) return line + 1;
  if (text.length >= min * 2) {
    const sentence = lastAfter(/[.!?;:](?:["'”»)\]]*)\s+/g);
    if (sentence >= min / 2) return sentence;
  }
  if (text.length >= min * 3) {
    const space = text.lastIndexOf(" ");
    return space > 0 ? space + 1 : text.length;
  }
  return 0;
}
