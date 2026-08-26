import type { ExtractedAnswer, Question } from "./types";

/**
 * Reduce a printed or handwritten question label to a comparable key.
 *
 * Teachers' papers and students' sheets disagree constantly about punctuation
 * and spacing: "11 (a)", "11(a)", "Q11a", "11.a", "11-A" are all the same
 * question. Strip everything that isn't alphanumeric and lowercase the rest.
 *
 *   "Q11 (a)" -> "11a"      "5." -> "5"      "Ans 3(ii)" -> "3ii"
 */
export function normalizeLabel(label: string | null | undefined): string {
  if (!label) return "";
  return label
    .toLowerCase()
    .replace(/\b(?:q(?:uestion)?|ans(?:wer)?|no|sl)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}

export interface DeterministicMatch {
  /** questionId -> answerId, for pairs matched purely on label. */
  byQuestion: Map<string, string>;
  /** Questions with no confident label match; these go to the model. */
  unresolvedQuestions: Question[];
  /** Answers with no confident label match; these go to the model. */
  unresolvedAnswers: ExtractedAnswer[];
}

/**
 * Match answers to questions by normalized label before involving the model.
 *
 * A label match is only accepted when it is unambiguous on both sides: exactly
 * one question and exactly one answer carry that key. Duplicates (a student
 * numbering two blocks "7", or a paper with a repeated label) are pushed to the
 * content-based pass rather than guessed at.
 */
export function matchByLabel(
  questions: Question[],
  answers: ExtractedAnswer[],
): DeterministicMatch {
  const questionsByKey = groupBy(questions, (q) => normalizeLabel(q.label));
  const answersByKey = groupBy(answers, (a) => normalizeLabel(a.claimedLabel));

  const byQuestion = new Map<string, string>();
  const usedQuestionIds = new Set<string>();
  const usedAnswerIds = new Set<string>();

  for (const [key, qs] of questionsByKey) {
    if (!key) continue;
    const as = answersByKey.get(key);
    if (!as) continue;
    if (qs.length !== 1 || as.length !== 1) continue; // ambiguous, defer

    byQuestion.set(qs[0].id, as[0].id);
    usedQuestionIds.add(qs[0].id);
    usedAnswerIds.add(as[0].id);
  }

  return {
    byQuestion,
    unresolvedQuestions: questions.filter((q) => !usedQuestionIds.has(q.id)),
    unresolvedAnswers: answers.filter((a) => !usedAnswerIds.has(a.id)),
  };
}

function groupBy<T>(items: T[], key: (item: T) => string): Map<string, T[]> {
  const out = new Map<string, T[]>();
  for (const item of items) {
    const k = key(item);
    const existing = out.get(k);
    if (existing) existing.push(item);
    else out.set(k, [item]);
  }
  return out;
}

/**
 * Convert Gemini's [ymin, xmin, ymax, xmax] (scaled 0-1000) into a fractional
 * box. Returns null for degenerate or out-of-range rectangles so a bad
 * detection renders as "no highlight" rather than a box over the whole page.
 */
export function normalizeBox(
  raw: number[] | null | undefined,
): { x: number; y: number; w: number; h: number } | null {
  if (!raw || raw.length !== 4 || raw.some((n) => typeof n !== "number" || !isFinite(n))) {
    return null;
  }
  const [ymin, xmin, ymax, xmax] = raw.map((n) => Math.min(1000, Math.max(0, n)) / 1000);
  const w = xmax - xmin;
  const h = ymax - ymin;
  if (w <= 0.001 || h <= 0.001) return null;
  return { x: xmin, y: ymin, w, h };
}
