# myKPT: roadmap to best-in-class

Written 19 November 2026, after the preliminary selection. It covers the seven goals set for the next round:
look, ease of use, student safety, a syllabus knowledge base (RAG), market gaps, a complete learning platform for Mauritius, and beating rival products.

Status key: **Done** (built and tested on branch `feat/safety-and-syllabus-rag`), **Built, not live** (code complete; needs the database migration applied and real-traffic checks), **Next**, **Later**.

---

## 1. Where the market is weak

| Product | What it does well | What it misses for a Mauritian student |
|---|---|---|
| **myt Learn** (edu.mytgpt.mu) | Deep unit structure for 19 subjects, textbook viewer, mind maps, refuses to write essays | Only answers from its knowledge base (failed *7x − 11 = 5*); 20–45 s replies; shows tool calls and prompt text; weak Kreol; thin personalisation; no privacy notice; security hygiene gaps (localhost CORS, no CSP/HSTS, test model entry exposed). Scored 2.9 / 5 in our evaluation. |
| **Khanmigo** (Khan Academy) | Socratic tutor, teacher alerts when a student shares something worrying, parent visibility | Built around Khan Academy's own (mainly US) courses; no SC/HSC or NCF mapping; no Kreol Morisien |
| **ChatGPT Study Mode / general chatbots** | Flexible, fast | No curriculum, no progress, no safeguarding for minors, easy to get full homework answers |
| **Photomath / Socratic** | Instant photo-to-solution for maths | Gives answers rather than teaching; maths only; no Mauritian context |
| **Quizlet** | Flashcards and quick practice | Not syllabus-aligned for Mauritius; content quality varies |
| **Tutopiya / CambriLearn** | Human tutors, Cambridge past papers by syllabus code | Paid per hour; no NCF Grades 7–9; no AI tutor available any time |

**The gap nobody fills:** a tutor that is *fast*, *answers anything school-related* but is *grounded in the Mauritian syllabus when it matters*, teaches properly in **English, French and Kreol Morisien**, is **safe for 11-year-olds**, and gives parents and (later) teachers visibility. That is myKPT's position.

## 2. Features rivals lack, to add to myKPT

Ordered by value to students and evaluators.

1. **Grounded but never gated answers.** The tutor uses official syllabus extracts when they exist and still answers when they don't. *Built, not live: see §4.*
2. **Syllabus-aware tutor.** Answers name where the topic sits ("This is part of Grade 10 Physics: forces and motion") without showing internal machinery. *Built, not live.*
3. **Real safeguarding, not just filters.** Screening before anything is stored, chunked checking of replies before students see them, prompt-injection detection, age bands, verified Mauritian helplines. *Done: see §3.*
4. **Past-paper practice by SC/HSC syllabus code**, marked against mark schemes with partial credit (exam marking exists; past papers need licensed sources). *Next.*
5. **Exam countdown and study planner.** The student enters exam dates; the platform builds a weekly plan from weak units and spaced repetition. *Next.*
6. **Photo-of-homework → Socratic hints** (attachments exist; add a "check my working" mode that finds the first wrong step). *Next.*
7. **Parent weekly digest.** A short email showing time studied, units mastered and wellbeing flags (never chat content). It builds on the existing parent link. Required anyway for under-16 consent. *Next.*
8. **Offline lesson packs** for students with poor data at home (PWA exists; add "download this unit"). *Next.*
9. **Read-aloud and dyslexia mode** (Atkinson Hyperlegible is already in use; add text-to-speech and line focus). *Later.*
10. **Teacher app:** class codes, assignments and a safeguarding inbox, plus a Ministry usage dashboard as the evaluation report asks. The schema already allows for it. *Later.*
11. **Kreol quality loop.** A native-speaker review queue for Kreol lesson content, with students able to flag awkward Kreol in one tap. *Later.*

## 3. Safety guardrails for minors

### Legal baseline (Mauritius)
- **Data Protection Act 2017, section 30 (verbatim):** "(1) No person shall process the personal data of a child below the age of 16 years unless consent is given by the child's parent or guardian. (2) Where the personal data of a child below the age of 16 years is involved, a controller shall make every reasonable effort to verify that consent has been given or authorised, taking into account available technology." Grades 7–11 are mostly under 16, so a **verified parental consent step is mandatory** before national use. Section 34 also requires a data protection impact assessment for risky processing.
- **Computer Misuse and Cybercrime Act:** penetration tests need written authorisation. Commission an authorised pen test before national scale.

### Verified help numbers (used in the tutor and the help page)
- **999** police emergency, **114** SAMU ambulance
- **113** Child Development Unit hotline: 24/7 line to report abuse of children (Ministry of Gender Equality and Family Welfare)

### Built in this phase (*Done*)
| Guardrail | Before | Now |
|---|---|---|
| Input screening | After the message was saved; failed open | **Before** saving. On a classifier outage a local keyword screen still catches self-harm and contact details |
| Personal data | Logged only; phone numbers and emails stored | Phone numbers and emails are **redacted** before storage and before reaching the model, and the student gets a gentle reminder |
| Images and PDFs | Not screened | Images are screened with the text |
| Tutor replies | Whole reply streamed, then replaced if unsafe (the student had already read it) | Reply is checked **paragraph by paragraph (or sentence by sentence for long unbroken text) before release**. Checks run while the model keeps writing, so the first words appear after about one check (~0.3–1 s) |
| Safety-check outages | A slow check could hold everything (10-minute default timeout) | Each check gives up after 6 s. Input then falls back to the local self-harm screen; replies are released unchecked (the tutor's own safety instructions still apply). Both are logged |
| Prompt injection / jailbreaks | Not detected | New `manipulation` category: attempts to override instructions or extract the system prompt get a friendly redirect and are logged. Students cannot type the platform-only `<syllabus_context>` markup (it is stripped) |
| Age bands | Same tone for 11 and 19-year-olds | Grades 7–9 get stricter, simpler handling of sensitive topics |
| Help page | None | `/help` page in all three languages with tap-to-call numbers, in the profile menu; the tutor's safety reply names it and gives 113, 999 and 114 |
| Repeated risk | — | The existing `moderation_events` log already records each flag per student (category only, never content). Phase B uses it for parent/teacher alerts |

**Cost effect.** Output checking adds one Haiku call per ~700 characters of tutor reply (about 3–5 per typical answer), plus image screening. At Haiku 4.5 prices this is small next to the Sonnet reply, but the costing report should add it as its own line. Stopping generation as soon as a paragraph fails also saves the rest of that reply.

**Tests.** `tests/e2e/safety-logic.spec.ts` covers redaction (contact details removed; maths and science numbers kept), the fallback screen, forged-markup stripping and the reply guard (order, blocking, latency, long paragraphs).

### Next
- **Parental consent gate** for under-16 sign-ups (parent confirms by email link; tutor locked until confirmed; lessons stay open).
- **Safeguarding alerts**: repeated self-harm flags notify the parent (and the school's designated safeguarding lead once the teacher app exists), with category and time only.
- **Content-Security-Policy and HSTS** in `next.config.ts` (start in report-only mode because Paddle checkout loads external scripts).
- **Data controls**: export my data and delete my account in Settings; publish retention periods (chats 12 months, moderation events 90 days).
- **Red-team suite**: a Playwright plus script set of 50 jailbreak and injection prompts in en/fr/mfe, run before every release.
- `/.well-known/security.txt` and a responsible-disclosure contact.

## 4. Syllabus knowledge base (RAG)

### Design (*Built, not live*: migration `20261119000000_syllabus_rag.sql` must be applied, outlines loaded, and retrieval quality checked on real questions)
- **Tables:** `syllabus_documents` (title, subject, grade range, locale, **source**: `official` | `teacher` | `generated`, publisher, licence, URL) and `syllabus_chunks` (heading, text, unit link, full-text index per language, nullable `embedding` column for vector search later). Signed-in students can read them; only the server writes.
- **Search:** Postgres full-text search with a language setting per chunk (English, French, and `simple` for Kreol), filtered to the student's subject and grade (their own grade and below). Words are OR-ed with a minimum score, results are limited to one per unit, and the student's language and grade rank first. One call before the reply. No visible tool calls and no chained lookups.
- **Never gates:** found extracts are added as extra context. If nothing matches, the tutor answers normally.
- **Prompt caching kept:** extracts go in the latest student turn, not the system prompt, so the cached conversation stays valid.
- **Honest provenance:** the existing unit/lesson outlines were drafted by AI (`scripts/curriculum/generate.mts`), so they are loaded as `source = generated`. Only documents you supply are marked `official`.

### How to load official material
1. Put files in `syllabus/inbox/<subject-id>/` (PDF, Markdown or text) with a small `manifest.json` per folder: title, grades, locale, source, publisher, licence.
2. Run `node --env-file=.env.local scripts/syllabus/ingest.mts`. It extracts the text, splits it by heading into chunks of about 1,200 characters, and upserts.
3. Recommended first sources: MIE *Teaching and Learning Syllabus* Grades 7–9 for each subject (web.mie.ac.mu), Cambridge SC/HSC syllabuses for Mauritius (cambridgeinternational.org/mauritius), and MES past papers with mark schemes. **Check the licence for each one**; MIE asks that its materials be acknowledged and used for educational purposes.

### Next
- **Vector search:** add an embeddings key (for example `VOYAGE_API_KEY`, the provider Anthropic recommends for multilingual embeddings) to `.env.local`. The `embedding` column and index are ready; retrieval will then blend keyword and meaning-based search.
- Ground **lesson generation** and **revision summaries** in the same extracts, so lesson content cites the official syllabus.
- Admin page for teachers to upload school notes as `source = teacher`.

## 5. Look and ease of use

The design system is already strong (lagoon/flamboyant palette, Atkinson Hyperlegible, subject art, light and dark, 360 px-first). The next pass should polish rather than restyle:
- **Home as a "today" plan:** one primary action (due flashcards, or continue lesson, or exam countdown task) instead of several equal cards.
- **Tutor answers with structure:** collapsible "Steps", "Check yourself" and "Syllabus link" blocks rendered from the answer, not raw Markdown alone.
- **Immediate feedback in quizzes** (myt Learn's W9) and celebration moments on mastery (one animation, reduced-motion aware).
- **Explain weak areas:** show *why* a unit is weak (quiz 2/5 on 12 Nov, 3 flashcards overdue).
- **Laptop widths 900–1100 px:** keep every tool visible (myt Learn hid its tools panel).
- Usability test with 5 students per stage (Grade 7, Grade 10, Grade 12) before the next judging round.

## 6. Phases

| Phase | Content | Status |
|---|---|---|
| A | Roadmap; safety guardrails; help page | **Done** |
| A2 | RAG foundation and ingestion | **Built, not live**: apply migration, load outlines, check retrieval |
| B | Parental consent gate; data export/delete; CSP/HSTS; red-team suite; security.txt | Next |
| C | Load official syllabi; embeddings; ground lessons and summaries; past papers | Next (needs your source documents and an embeddings key) |
| D | Study planner and exam countdown; check-my-working; parent digest; offline unit packs | Next |
| E | UX polish pass (§5) with student usability tests | Next |
| F | Teacher app, safeguarding inbox, Ministry dashboard | Later |

## Sources
- myKPT evaluation reports in `../reports/` (myt Learn strengths/weaknesses, security review, evaluation), 24 Sep 2026
- Khan Academy, *Framework for Responsible AI in Education*: https://blog.khanacademy.org/khan-academys-framework-for-responsible-ai-in-education/
- UNESCO generative-AI guidance on age limits (2023), reported: https://techxplore.com/news/2023-09-age-limits-ai-tools-schools.html
- Mauritius DPA 2017, child consent summary: https://www.globallegalpost.com/lawoverborders/data-protection-law-guide-1072382791/mauritius-1530183321 and statute: https://www.fscmauritius.org/media/ikoldflp/the-data-protection-act-2017.pdf
- 113 hotline: Mauritius submission to UN (2024): https://knowledge.unwomen.org/sites/default/files/2024-10/a-79-322-submission-mauritius-en.pdf and https://gbvo.mric.mu/dashboard/child-abuse/
- MIE curriculum development: https://web.mie.ac.mu/curriculum-developments/
- Tutopiya (Mauritius SC/HSC tutoring): https://www.tutopiya.com/blog/mauritius-students-affordable-tutoring-tutopiya-vs-port-louis-competitors/
