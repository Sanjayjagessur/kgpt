# Syllabus inbox

Material placed here is loaded into the tutor's knowledge base by
`node --env-file=.env.local scripts/syllabus/ingest.mts`. The tutor uses it to keep
answers consistent with the Mauritian syllabus. It still answers questions the
material doesn't cover.

## Add a document

1. Create a folder in `syllabus/inbox/`, for example `mie-tls-mathematics-g7-9/`.
2. Put the files in it: PDF, Markdown (`.md`) or plain text (`.txt`).
3. Add a `manifest.json`:

```json
{
  "slug": "mie-tls-mathematics-g7-9",
  "title": "MIE Teaching and Learning Syllabus: Mathematics, Grades 7–9",
  "subject": "mathematics",
  "gradeMin": 7,
  "gradeMax": 9,
  "locale": "en",
  "source": "official",
  "publisher": "Mauritius Institute of Education",
  "licence": "Educational use with acknowledgement of the MIE",
  "url": "https://web.mie.ac.mu/"
}
```

- `subject` is a subject id from `src/config/subjects.ts` (for example `mathematics`, `physics`, `kreol-morisien`).
- `source` is `official` (MIE, MES, Cambridge) or `teacher` (school notes). Only use `official` for documents from those bodies.
- `locale` is the language of the document: `en`, `fr` or `mfe`.

4. Check what will be loaded: `node scripts/syllabus/ingest.mts --dry-run`
5. Load it: `node --env-file=.env.local scripts/syllabus/ingest.mts`

Re-running replaces a document with the same `slug`. Folders starting with `_` are examples and only load when named
(`ingest.mts _example-maths-g7`).

## Copyright

Check the licence of every document before adding it. Source files in this folder are not committed to git (see `.gitignore`); only the manifests are.

## Draft outlines

`ingest.mts --outlines` loads the AI-drafted unit outlines from `supabase/curriculum/` as `source = generated`.
The tutor treats them as a guide to scope and level only, never as official text.
