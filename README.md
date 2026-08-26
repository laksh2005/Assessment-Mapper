# AI Assessment Extraction & Answer Mapping

Upload a question paper and one student's handwritten answer sheet. The app extracts every
question in printed order, transcribes and locates each written answer, maps answers to
questions, highlights the exact region of the sheet each answer occupies, and grades the
paper with per-question feedback.

**AI model:** Gemini 2.5 Flash (Google AI Studio free tier).

## Running locally

```bash
npm install
```

Add a free API key from [Google AI Studio](https://aistudio.google.com/apikey) to
`.env.local`:

```bash
GEMINI_API_KEY=your_key_here
```

```bash
npm run dev
```

Sample fixtures that exercise every edge case below are generated with:

```bash
node scripts/make-samples.mjs
```

## Approach

The pipeline is `Question Extraction → Answer Extraction → Mapping → Grading`, and two
decisions shape everything else.

### 1. Pages are rasterized in the browser, before upload

Both inputs — PDF or images — are rendered to page PNGs client-side with `pdf.js`
(`lib/pdf.ts`), and only then sent to the API.

Highlighting needs a coordinate frame. Because the model reasons over the exact bitmap the
browser is already displaying, the bounding boxes it returns and the pixels on screen are
the same space by construction: no PDF-point-to-CSS-pixel conversion, no scale drift, no
rounding error accumulating between two rendering paths. It also keeps native PDF
libraries out of the serverless bundle.

Boxes are stored as fractions of page width/height (0–1) and rendered as CSS percentages,
so they stay aligned at any zoom level or container width.

### 2. Answer extraction never sees the question paper

The answer pass (`ANSWER_EXTRACTION_PROMPT`) is given only the answer sheet. It reports
what is written, including the question number the student wrote — verbatim, uncorrected.

This is the load-bearing decision for edge cases. If extraction is shown the question list,
the model helpfully invents an answer for every question, and "unanswered" and "unmatched"
quietly stop meaning anything. Keeping the passes independent is what makes those states
honest rather than decorative.

### 3. Mapping is deterministic first, model second

`lib/mapping.ts` normalizes labels (`11 (a)`, `Q11a`, `11.a`, `11-A` all reduce to `11a`)
and matches exactly. A match is accepted only when the key is unambiguous on *both* sides —
exactly one question and exactly one answer carry it. Everything else falls through to a
text-only Gemini pass that matches on content and grades in the same call.

Most answers resolve deterministically, with no opportunity for the model to hallucinate a
pairing. The model only sees the genuinely hard cases, and its pre-matched pairs are passed
in as fixed so it cannot revise them.

## Edge cases

| Case | How it is handled |
| --- | --- |
| Sub-parts (`4 (a)`, `4 (b)`) | Extracted as separate entries; the prompt folds a shared stem into each sub-part so both read as complete questions |
| Original numbering | Labels are reproduced verbatim and never renumbered; display order comes from a re-indexed `order` field |
| Answers out of order | Mapping is by label and content, never by position, so ordering is irrelevant |
| Unanswered question | Answer is `null`, verdict is `unanswered` (never `incorrect`), row shows an "Unanswered" badge and it is counted in the summary |
| Answer matching no question | Kept in `unmatchedAnswers`, listed in its own section, and still clickable and highlightable |
| Mislabelled answer | Label match fails, content match catches it, and the row is tagged "Matched by content" with a confidence score |
| Low-confidence match | Flagged "Low confidence — verify" below 0.6 so the teacher checks it |
| Answer spanning pages | One span per page; all spans highlight together and the badge reads `1/2`, `2/2` |

## Progress reporting

`POST /api/analyze` streams NDJSON progress events from a single invocation and returns the
result on the last line.

The obvious alternative — start a job, poll `GET /api/jobs/:id` — breaks on serverless:
polls are not guaranteed to reach the instance holding the job, so it works locally and
fails in production. Streaming from one request needs no server-side state at all, which
also satisfies the "in-memory storage is sufficient" constraint.

## Structure

```
app/page.tsx              upload → progress → results
app/api/analyze/route.ts  streaming pipeline
components/               UploadPanel, LoadingState, ResultsView, QuestionList, AnswerViewer
lib/pdf.ts                pdf.js → page PNGs (client-side)
lib/gemini.ts             three model calls + response schemas
lib/prompts.ts            extraction and mapping prompts
lib/mapping.ts            label normalization, deterministic matcher, box normalization
lib/types.ts              shared types
```

## Assumptions and limitations

- One student's answer sheet per run, as specified in the brief.
- Built for single-digit page counts. Very long scans risk the serverless time limit, since
  the whole pipeline runs in one request.
- Highlight accuracy depends on Gemini's bounding boxes. Boxes are validated and degenerate
  ones dropped, so a bad detection renders as "no highlight" rather than a box over the
  whole page — but a merely loose box will render loosely.
- Grading is generative and meant as a first pass for a teacher to review, not a final mark.
  Marks come from the paper where printed, defaulting to 1 where not.
- No auth and no database; state lives in React for the session and is lost on refresh.
