/**
 * Loads syllabus material into the tutor's knowledge base (syllabus_documents / syllabus_chunks).
 *
 *   node --env-file=.env.local scripts/syllabus/ingest.mts            # every folder in syllabus/inbox
 *   node --env-file=.env.local scripts/syllabus/ingest.mts maths-g7-9 # only these folders
 *   node --env-file=.env.local scripts/syllabus/ingest.mts --outlines # the AI-drafted unit outlines
 *   add --dry-run to print what would be loaded without writing
 *
 * Each inbox folder holds one document: a manifest.json plus its files (PDF, .md or .txt).
 * See syllabus/README.md. Re-running replaces a document with the same slug.
 * Writes use the service role key, so this runs only on a trusted machine.
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import { extractText, getDocumentProxy } from "unpdf";
import { z } from "zod";

const INBOX = path.resolve("syllabus/inbox");
const OUTLINES = path.resolve("supabase/curriculum");
const TARGET_CHARS = 1200;
const MAX_CHARS = 2000;

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const outlines = args.includes("--outlines");
const only = args.filter((a) => !a.startsWith("--"));

const Manifest = z.object({
  slug: z.string().regex(/^[a-z0-9._-]+$/),
  title: z.string().min(1),
  subject: z.string().regex(/^[a-z0-9-]+$/),
  gradeMin: z.number().int().min(7).max(13),
  gradeMax: z.number().int().min(7).max(13),
  locale: z.enum(["en", "fr", "mfe"]),
  source: z.enum(["official", "teacher"]),
  publisher: z.string().optional(),
  licence: z.string().optional(),
  url: z.url().optional(),
  /** Files to read, in order. Defaults to every .pdf/.md/.txt in the folder. */
  files: z.array(z.string()).optional(),
});

type Doc = {
  slug: string;
  title: string;
  subject_id: string;
  grade_min: number;
  grade_max: number;
  locale: "en" | "fr" | "mfe";
  source: "official" | "teacher" | "generated";
  publisher: string | null;
  licence: string | null;
  url: string | null;
};
type Chunk = { heading: string; content: string; grade_min: number; grade_max: number; unit_id: string | null };

// ---------------------------------------------------------------------------
// Text extraction and chunking
// ---------------------------------------------------------------------------

async function readText(file: string): Promise<string> {
  if (file.toLowerCase().endsWith(".pdf")) {
    const pdf = await getDocumentProxy(new Uint8Array(fs.readFileSync(file)));
    const { text } = await extractText(pdf, { mergePages: false });
    return text.join("\n\n");
  }
  return fs.readFileSync(file, "utf8");
}

/** Lines that look like section headings in syllabus documents. */
function headingOf(line: string): string | null {
  const t = line.trim();
  if (!t || t.length > 120) return null;
  const md = /^#{1,4}\s+(.+)$/.exec(t);
  if (md) return md[1].trim();
  if (/^(unit|topic|theme|strand|section|chapter|module|unité|thème|chapitre|inite|tem)\s+[\dIVXivx]+[.:)\s-]/i.test(t)) return t;
  if (/^\d+(\.\d+){0,2}\s+[A-ZÀ-Ý]/.test(t) && !/[.;:]$/.test(t) && t.split(" ").length <= 12) return t;
  if (t === t.toUpperCase() && /[A-Z]{4}/.test(t) && t.split(" ").length <= 10) return t;
  return null;
}

/** Splits text into chunks of about TARGET_CHARS, never across a heading. */
export function chunkText(text: string): { heading: string; content: string }[] {
  const lines = text.replace(/\r/g, "").replace(/[ \t]+/g, " ").split("\n");
  const chunks: { heading: string; content: string }[] = [];
  let heading = "";
  let buf: string[] = [];
  const flush = () => {
    const content = buf.join("\n").replace(/\n{3,}/g, "\n\n").trim();
    if (content.length >= 40) {
      // Hard-split very long runs (e.g. tables extracted as one line).
      for (let i = 0; i < content.length; i += MAX_CHARS) chunks.push({ heading, content: content.slice(i, i + MAX_CHARS) });
    }
    buf = [];
  };
  for (const line of lines) {
    const h = headingOf(line);
    if (h) {
      flush();
      heading = h;
      continue;
    }
    buf.push(line);
    const size = buf.reduce((n, l) => n + l.length + 1, 0);
    if (size >= TARGET_CHARS && line.trim() === "") flush();
    else if (size >= MAX_CHARS) flush();
  }
  flush();
  return chunks;
}

// ---------------------------------------------------------------------------
// Sources
// ---------------------------------------------------------------------------

async function inboxDocuments(): Promise<{ doc: Doc; chunks: Chunk[] }[]> {
  if (!fs.existsSync(INBOX)) return [];
  const folders = fs
    .readdirSync(INBOX, { withFileTypes: true })
    // Folders starting with "_" (examples) load only when named explicitly.
    .filter((d) => d.isDirectory() && (only.length ? only.includes(d.name) : !d.name.startsWith("_")))
    .map((d) => d.name)
    .sort();
  const out: { doc: Doc; chunks: Chunk[] }[] = [];
  for (const folder of folders) {
    const dir = path.join(INBOX, folder);
    const manifestPath = path.join(dir, "manifest.json");
    if (!fs.existsSync(manifestPath)) {
      console.warn(`skip ${folder}: no manifest.json`);
      continue;
    }
    const parsed = Manifest.safeParse(JSON.parse(fs.readFileSync(manifestPath, "utf8")));
    if (!parsed.success) {
      console.error(`skip ${folder}: invalid manifest\n${z.prettifyError(parsed.error)}`);
      continue;
    }
    const m = parsed.data;
    if (m.gradeMin > m.gradeMax) {
      console.error(`skip ${folder}: gradeMin is above gradeMax`);
      continue;
    }
    const files = (m.files ?? fs.readdirSync(dir).filter((f) => /\.(pdf|md|txt)$/i.test(f)).sort()).map((f) =>
      path.join(dir, f),
    );
    const chunks: Chunk[] = [];
    for (const file of files) {
      const text = await readText(file);
      for (const c of chunkText(text)) chunks.push({ ...c, grade_min: m.gradeMin, grade_max: m.gradeMax, unit_id: null });
    }
    out.push({
      doc: {
        slug: m.slug,
        title: m.title,
        subject_id: m.subject,
        grade_min: m.gradeMin,
        grade_max: m.gradeMax,
        locale: m.locale,
        source: m.source,
        publisher: m.publisher ?? null,
        licence: m.licence ?? null,
        url: m.url ?? null,
      },
      chunks,
    });
  }
  return out;
}

// Same ids as scripts/curriculum/to-sql.mts, so outline chunks link to their units.
const NAMESPACE = "6f1c2a7e-3b8d-4f5a-9c0e-2d4b6a8c0e1f";
function uuidv5(name: string): string {
  const ns = Buffer.from(NAMESPACE.replace(/-/g, ""), "hex");
  const hash = crypto.createHash("sha1").update(Buffer.concat([ns, Buffer.from(name, "utf8")])).digest();
  const bytes = hash.subarray(0, 16);
  bytes[6] = (bytes[6] & 0x0f) | 0x50;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString("hex");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

type L = { en: string; fr: string; mfe: string };
type Outline = { units: { title: L; summary: L; lessons: { title: L; objectives: string[] }[] }[] };

/** The AI-drafted outlines, one chunk per unit. Marked source = generated (scope guide, not official text). */
function outlineDocuments(): { doc: Doc; chunks: Chunk[] }[] {
  const out: { doc: Doc; chunks: Chunk[] }[] = [];
  for (const file of fs.readdirSync(OUTLINES).filter((f) => f.endsWith(".json")).sort()) {
    const data = JSON.parse(fs.readFileSync(path.join(OUTLINES, file), "utf8")) as {
      subject: string;
      grades: Record<string, Outline>;
    };
    if (only.length && !only.includes(data.subject)) continue;
    const grades = Object.keys(data.grades).map(Number);
    for (const locale of ["en", "fr", "mfe"] as const) {
      const chunks: Chunk[] = [];
      for (const [g, outline] of Object.entries(data.grades)) {
        const grade = Number(g);
        outline.units.forEach((unit, u) => {
          const lessons = unit.lessons
            .map((l, i) => {
              // Objectives exist in English only; include them for the English document.
              const objectives = locale === "en" && l.objectives.length ? `\n  - ${l.objectives.join("\n  - ")}` : "";
              return `${i + 1}. ${l.title[locale] || l.title.en}${objectives}`;
            })
            .join("\n");
          chunks.push({
            heading: `Grade ${grade}, Unit ${u + 1}: ${unit.title[locale] || unit.title.en}`,
            content: `${unit.summary[locale] || unit.summary.en}\n\n${lessons}`.slice(0, MAX_CHARS * 2),
            grade_min: grade,
            grade_max: grade,
            unit_id: uuidv5(`${data.subject}/${grade}/${u + 1}`),
          });
        });
      }
      out.push({
        doc: {
          slug: `outline.${data.subject}.${locale}`,
          title: `myKPT unit outline (draft): ${data.subject}`,
          subject_id: data.subject,
          grade_min: Math.min(...grades),
          grade_max: Math.max(...grades),
          locale,
          source: "generated",
          publisher: "myKPT (AI-drafted, pending educator review)",
          licence: null,
          url: null,
        },
        chunks,
      });
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Upload
// ---------------------------------------------------------------------------

async function main() {
  const docs = outlines ? outlineDocuments() : await inboxDocuments();
  if (!docs.length) {
    console.log(outlines ? "No outlines found." : `Nothing to load. Add folders to ${path.relative(".", INBOX)} (see syllabus/README.md).`);
    return;
  }
  for (const { doc, chunks } of docs) {
    console.log(`${dryRun ? "[dry run] " : ""}${doc.slug}: ${chunks.length} chunks (${doc.source}, ${doc.locale}, grades ${doc.grade_min}–${doc.grade_max})`);
  }
  if (dryRun) {
    const sample = docs[0].chunks[0];
    if (sample) console.log(`\nFirst chunk of ${docs[0].doc.slug}:\n[${sample.heading}]\n${sample.content.slice(0, 600)}`);
    return;
  }

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Set NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (run with --env-file=.env.local).");
  const db = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });

  for (const { doc, chunks } of docs) {
    // Replace any earlier version of this document (chunks cascade).
    const del = await db.from("syllabus_documents").delete().eq("slug", doc.slug);
    if (del.error) throw new Error(`${doc.slug}: ${del.error.message}`);
    const ins = await db.from("syllabus_documents").insert(doc).select("id").single();
    if (ins.error) throw new Error(`${doc.slug}: ${ins.error.message}`);
    const rows = chunks.map((c, i) => ({
      document_id: ins.data.id,
      position: i + 1,
      subject_id: doc.subject_id,
      locale: doc.locale,
      source: doc.source,
      ...c,
    }));
    for (let i = 0; i < rows.length; i += 200) {
      const res = await db.from("syllabus_chunks").insert(rows.slice(i, i + 200));
      if (res.error) throw new Error(`${doc.slug} chunks: ${res.error.message}`);
    }
    console.log(`loaded ${doc.slug}`);
  }
}

await main();
