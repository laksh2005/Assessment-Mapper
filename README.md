# AI Assessment Extraction & Answer Mapping

Upload a question paper and a student's handwritten answer sheet. The app extracts every
question, transcribes and locates each answer, maps answers to questions, highlights the
exact region on the sheet, and grades with feedback.

**AI model:** Gemini 2.5 Flash (Google AI Studio free tier).

## Setup

```bash
npm install
```

Add a free key from [Google AI Studio](https://aistudio.google.com/apikey) to `.env.local`:

```
GEMINI_API_KEY=your_key_here
```

```bash
npm run dev
```

Generate sample fixtures covering every edge case below:

```bash
node scripts/make-samples.mjs
```

## Approach

`Question Extraction → Answer Extraction → Mapping → Grading`, driven by three decisions.

**Pages are rasterized in the browser before upload.** Both inputs, PDF or image, are
rendered to page bitmaps client-side with pdf.js. The model reasons over the exact bitmap
the browser displays, so its bounding boxes and the pixels on screen are the same
coordinate space — no conversion, no scale drift. Boxes are stored as fractions of page
size and rendered as percentages, staying aligned at any zoom.

**Answer extraction never sees the question paper.** It reports what is written, including
the question number the student wrote, verbatim and uncorrected. Show the model the
question list and it invents an answer for every question, which silently breaks the
unanswered and unmatched cases.

**Mapping is deterministic first.** Labels are normalized (`11 (a)`, `Q11a`, `11.a` → `11a`)
and matched exactly, accepted only when unambiguous on both sides. Only genuinely
ambiguous cases reach the model, which matches on content and grades in the same call.

## Edge cases

| Case | Handling |
| --- | --- |
| Sub-parts `4 (a)` / `4 (b)` | Separate entries; shared stem folded into each |
| Original numbering | Labels reproduced verbatim, never renumbered |
| Answers out of order | Mapping is by label and content, never position |
| Unanswered question | Verdict `unanswered` (never `incorrect`), badged and counted |
| Answer matching no question | Kept in its own section, still clickable and highlightable |
| Mislabelled answer | Content match catches it, tagged "Matched by content" |
| Low-confidence match | Flagged "Low confidence — verify" below 0.6 |
| Answer spanning pages | One span per page, all highlighted, badge reads `1/2` |

## Structure

```
app/page.tsx              upload → progress → results
app/api/analyze/route.ts  streaming pipeline
components/               UploadPanel, LoadingState, ResultsView, QuestionList, AnswerViewer
lib/pdf.ts                pdf.js → page images (client-side)
lib/gemini.ts             three model calls + response schemas
lib/prompts.ts            extraction and mapping prompts
lib/mapping.ts            label normalization, matcher, box normalization
```

`POST /api/analyze` streams NDJSON progress from a single request. A job id plus polling
would be unreliable on serverless, where a poll can reach an instance that never saw the
job; streaming needs no server state at all.

## Assumptions and limitations

- One answer sheet per run, as specified in the brief.
- Built for single-digit page counts. Page images are posted inline, so uploads are capped
  at ~4 MB to stay under the serverless request limit, and very long papers risk the
  function timeout.
- Highlight accuracy depends on the model's bounding boxes. Degenerate boxes are dropped,
  so a bad detection renders as no highlight rather than a box over the whole page.
- Grading is generative — a first pass for a teacher to review, not a final mark. Marks come
  from the paper where printed, defaulting to 1 where not.
- No auth, no database; state lives in React for the session.
