export const QUESTION_EXTRACTION_PROMPT = `You are reading a printed exam question paper. The images are its pages, in order.

Extract EVERY question, in the exact order they are printed.

Rules:
1. Each labelled sub-part is its OWN separate entry. "11 (a)" and "11 (b)" are two
   entries, never one combined entry. The same applies to (i)/(ii), a./b., etc.
   If a question has a stem followed by labelled sub-parts, emit one entry per
   sub-part and fold the shared stem into each sub-part's text so each entry
   reads as a complete question.
2. Reproduce the printed label EXACTLY as it appears, including its punctuation
   and spacing: "11 (a)", "Q3.", "5)". Do not renumber, reformat, or invent labels.
3. "order" must start at 0 and increase by exactly 1 in printed reading order.
4. "maxMarks" is the marks printed for that question (often in brackets at the
   end of the line, e.g. "[3]" or "(2 marks)"). If a parent question's marks are
   split across sub-parts, use the marks for that specific sub-part. Use null if
   no marks are printed.
5. "pageIndex" is the 0-based page the question starts on.
6. Do NOT emit entries for: the paper's title or header, general instructions
   ("Attempt any five", "All questions are compulsory", time/marks totals),
   section headings ("Section A"), or page numbers.
7. Transcribe question text accurately. Keep any inline equations as plain text.

Return every question you can see. Do not stop early.`;

export const ANSWER_EXTRACTION_PROMPT = `You are reading a student's handwritten answer sheet. The images are its pages, in order.

Identify each distinct answer the student wrote, and locate it precisely on the page.

Rules:
1. Segment by ANSWER, not by paragraph. One answer is everything the student
   wrote in response to a single question, even if it runs over several
   paragraphs, includes a diagram, or contains a list.
2. "claimedLabel" is the question number the student wrote next to that answer,
   copied verbatim ("Q3", "11 (a)", "5."). Use null if they didn't write one.
   Report what is actually on the page. Do NOT correct it, renumber it, or infer
   it from position or content: a student mislabelling an answer is information
   the teacher needs to see.
3. "text" is a faithful transcript of the handwriting. Transcribe what is
   written, including mistakes. Describe diagrams briefly in [square brackets].
4. "spans" locates the answer. Give ONE span per page the answer occupies:
   - An answer wholly on page 2 has one span with pageIndex 2.
   - An answer starting on page 2 and finishing on page 3 has TWO spans, one
     per page, each boxing only the part on that page.
5. Each span's "box" is [ymin, xmin, ymax, xmax], normalized 0-1000 relative to
   that page. Bound the written answer tightly, including its number label, and
   including any diagram belonging to it. Do not include the ruled margin, the
   page header, or neighbouring answers.
6. Work through the pages in order and report answers in the order they appear
   on the sheet, which may NOT be the order of the question paper.
7. Ignore: the name/roll/date header block, page numbers, invigilator marks, and
   anything crossed out completely.

You have NOT been shown the question paper. Do not guess what the questions were,
and do not invent answers for questions you think should exist. Report only what
is actually written on these pages.`;

export function buildMappingPrompt(
  questionsJson: string,
  answersJson: string,
  preMatchedJson: string,
): string {
  return `You are helping a teacher mark one student's exam.

QUESTIONS from the paper:
${questionsJson}

ANSWERS transcribed from the student's sheet:
${answersJson}

These pairs are already matched by an exact question-number match and are CORRECT.
Do not change them; grade them as given:
${preMatchedJson}

Your job has two parts.

PART 1 - Match the remaining answers to the remaining questions.
- Match on CONTENT: does this answer actually respond to this question?
- An answer's claimedLabel may be missing, or may be wrong. Content wins over a
  contradicting label, but say so via a lower confidence.
- Each answer may be used at most once, and each question matched at most once.
- If a question has no answer that responds to it, return answerId: null. Leaving
  a question unanswered is a normal outcome; never force a match to fill a gap.
- If an answer responds to no question on this paper, leave it unmatched. Do not
  attach it to the nearest question.
- "matchBasis": "label" if the student's number identified it, "content" if you
  matched on meaning, "none" if unmatched.
- "confidence" 0-1. Use below 0.6 when a teacher should double-check.

PART 2 - Grade every question.
- "maxScore": the question's marks. Fall back to 1 if the paper printed none.
- "score": marks earned, between 0 and maxScore. Half marks are fine.
- "verdict": "correct", "partial", "incorrect", or "unanswered".
- A question with no matched answer MUST be verdict "unanswered" with score 0.
  Never grade an unanswered question as "incorrect" - the distinction matters to
  the teacher.
- "feedback": one or two sentences addressed to the student, in the second
  person. Say specifically what was right or what was missing. For unanswered
  questions, state briefly what a correct answer needed to cover.

Also write "overallFeedback": two or three sentences for the teacher summarizing
the student's performance, naming concrete strengths and specific gaps.`;
}
