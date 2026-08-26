/** A rendered page of an uploaded document. */
export interface PageImage {
  /** 0-based index within its document. */
  pageIndex: number;
  /** PNG data URL, exactly what both the model and the browser see. */
  dataUrl: string;
  width: number;
  height: number;
}

/**
 * A rectangle on one page, in fractions of that page's width/height (0-1).
 *
 * Fractions rather than pixels so the overlay stays aligned at any zoom level
 * or container size. Gemini returns [ymin, xmin, ymax, xmax] scaled 0-1000;
 * `normalizeBox` converts to this shape.
 */
export interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** One page's worth of an answer. An answer running onto a second page has two. */
export interface AnswerSpan {
  pageIndex: number;
  box: Box;
}

export interface Question {
  id: string;
  /** Printed label, verbatim: "11 (a)", "Q3", "5." */
  label: string;
  text: string;
  /** Marks printed on the paper, if any. */
  maxMarks: number | null;
  pageIndex: number;
  /** Monotonic index preserving printed order. */
  order: number;
}

export interface ExtractedAnswer {
  id: string;
  /**
   * The question number the student wrote next to this answer, if any.
   * May be absent, and may not correspond to any real question.
   */
  claimedLabel: string | null;
  /** Transcript of the handwriting. */
  text: string;
  spans: AnswerSpan[];
}

export type MatchBasis = "label" | "content" | "none";

export interface Grade {
  score: number;
  maxScore: number;
  verdict: "correct" | "partial" | "incorrect" | "unanswered";
  feedback: string;
}

/** A question joined to the answer that was matched to it, if any. */
export interface MappedQuestion {
  question: Question;
  answer: ExtractedAnswer | null;
  matchBasis: MatchBasis;
  /** 0-1. Low values are surfaced in the UI so the teacher can verify. */
  confidence: number;
  grade: Grade;
}

export interface AnalysisResult {
  mapped: MappedQuestion[];
  /** Answers that matched no question on the paper. Still highlightable. */
  unmatchedAnswers: ExtractedAnswer[];
  summary: {
    totalQuestions: number;
    answeredCount: number;
    unansweredCount: number;
    unmatchedCount: number;
    totalScore: number;
    totalMaxScore: number;
    overallFeedback: string;
  };
}

/** Progress events streamed as NDJSON from POST /api/analyze. */
export type AnalyzeEvent =
  | { type: "progress"; stage: string; pct: number }
  | { type: "result"; result: AnalysisResult }
  | { type: "error"; message: string };
