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
    // Cut at the last paragraph break (or line break) so checks see whole thoughts.
    let cut = this.pending.lastIndexOf("\n\n");
    if (cut < min / 2) cut = this.pending.lastIndexOf("\n");
    if (cut < min / 2) return;
    this.enqueue(this.pending.slice(0, cut + 1));
    this.pending = this.pending.slice(cut + 1);
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
