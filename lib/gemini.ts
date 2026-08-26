import { GoogleGenAI, Type } from "@google/genai";
import {
  ANSWER_EXTRACTION_PROMPT,
  QUESTION_EXTRACTION_PROMPT,
  buildMappingPrompt,
} from "./prompts";
import { matchByLabel, normalizeBox } from "./mapping";
import type {
  AnalysisResult,
  ExtractedAnswer,
  Grade,
  MappedQuestion,
  MatchBasis,
  PageImage,
  Question,
} from "./types";

const MODEL = "gemini-2.5-flash";

function client(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Add it to .env.local (free key at https://aistudio.google.com/apikey).",
    );
  }
  return new GoogleGenAI({ apiKey });
}

function imageParts(pages: PageImage[]) {
  return pages.map((page) => {
    const [header, base64] = page.dataUrl.split(",", 2);
    // Derive the type from the data URL so the encoder in lib/pdf.ts stays free
    // to change without silently mislabelling the bytes here.
    const mimeType = /^data:([^;,]+)/.exec(header)?.[1] ?? "image/jpeg";
    return { inlineData: { mimeType, data: base64 } };
  });
}

/** Gemini occasionally wraps JSON in a code fence despite responseMimeType. */
function parseJson<T>(raw: string, what: string): T {
  const cleaned = raw
    .trim()
    .replace(/^[`]{3}(?:json)?\s*/i, "")
    .replace(/\s*[`]{3}$/, "");
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    throw new Error(`The model returned malformed JSON while ${what}.`);
  }
}

const questionSchema = {
  type: Type.OBJECT,
  properties: {
    questions: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          label: { type: Type.STRING, description: "Printed label, verbatim." },
          text: { type: Type.STRING },
          maxMarks: { type: Type.NUMBER, nullable: true },
          pageIndex: { type: Type.INTEGER },
          order: { type: Type.INTEGER },
        },
        required: ["label", "text", "pageIndex", "order"],
      },
    },
  },
  required: ["questions"],
};

const answerSchema = {
  type: Type.OBJECT,
  properties: {
    answers: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          claimedLabel: { type: Type.STRING, nullable: true },
          text: { type: Type.STRING },
          spans: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                pageIndex: { type: Type.INTEGER },
                box: {
                  type: Type.ARRAY,
                  items: { type: Type.NUMBER },
                  description: "[ymin, xmin, ymax, xmax], normalized 0-1000.",
                },
              },
              required: ["pageIndex", "box"],
            },
          },
        },
        required: ["text", "spans"],
      },
    },
  },
  required: ["answers"],
};

const mappingSchema = {
  type: Type.OBJECT,
  properties: {
    mappings: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          questionId: { type: Type.STRING },
          answerId: { type: Type.STRING, nullable: true },
          matchBasis: { type: Type.STRING, enum: ["label", "content", "none"] },
          confidence: { type: Type.NUMBER },
          score: { type: Type.NUMBER },
          maxScore: { type: Type.NUMBER },
          verdict: {
            type: Type.STRING,
            enum: ["correct", "partial", "incorrect", "unanswered"],
          },
          feedback: { type: Type.STRING },
        },
        required: [
          "questionId",
          "answerId",
          "matchBasis",
          "confidence",
          "score",
          "maxScore",
          "verdict",
          "feedback",
        ],
      },
    },
    overallFeedback: { type: Type.STRING },
  },
  required: ["mappings", "overallFeedback"],
};

export async function extractQuestions(pages: PageImage[]): Promise<Question[]> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [...imageParts(pages), { text: QUESTION_EXTRACTION_PROMPT }] },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: questionSchema,
      temperature: 0,
    },
  });

  const parsed = parseJson<{ questions: Omit<Question, "id">[] }>(
    res.text ?? "",
    "extracting questions",
  );

  return (parsed.questions ?? [])
    .slice()
    .sort((a, b) => a.order - b.order)
    .map((q, i) => ({
      id: `q${i}`,
      label: String(q.label ?? "").trim() || `${i + 1}`,
      text: String(q.text ?? "").trim(),
      maxMarks: typeof q.maxMarks === "number" ? q.maxMarks : null,
      pageIndex: Math.max(0, q.pageIndex ?? 0),
      // Re-index from the sorted order rather than trusting the model's counter.
      order: i,
    }));
}

export async function extractAnswers(pages: PageImage[]): Promise<ExtractedAnswer[]> {
  const res = await client().models.generateContent({
    model: MODEL,
    contents: [
      { role: "user", parts: [...imageParts(pages), { text: ANSWER_EXTRACTION_PROMPT }] },
    ],
    config: {
      responseMimeType: "application/json",
      responseSchema: answerSchema,
      temperature: 0,
    },
  });

  const parsed = parseJson<{
    answers: {
      claimedLabel?: string | null;
      text: string;
      spans: { pageIndex: number; box: number[] }[];
    }[];
  }>(res.text ?? "", "extracting answers");

  return (parsed.answers ?? []).map((a, i) => ({
    id: `a${i}`,
    claimedLabel: a.claimedLabel?.trim() || null,
    text: String(a.text ?? "").trim(),
    spans: (a.spans ?? [])
      .map((s) => {
        const box = normalizeBox(s.box);
        if (!box) return null;
        const pageIndex = Math.min(Math.max(0, s.pageIndex ?? 0), pages.length - 1);
        return { pageIndex, box };
      })
      .filter((s): s is { pageIndex: number; box: NonNullable<ReturnType<typeof normalizeBox>> } =>
        s !== null,
      ),
  }));
}

interface RawMapping {
  questionId: string;
  answerId: string | null;
  matchBasis: MatchBasis;
  confidence: number;
  score: number;
  maxScore: number;
  verdict: Grade["verdict"];
  feedback: string;
}

export async function mapAndGrade(
  questions: Question[],
  answers: ExtractedAnswer[],
): Promise<AnalysisResult> {
  const pre = matchByLabel(questions, answers);
  const answersById = new Map(answers.map((a) => [a.id, a]));

  // Transcripts only, no images: this pass is cheap next to the two vision calls.
  const questionsJson = JSON.stringify(
    questions.map((q) => ({ id: q.id, label: q.label, text: q.text, maxMarks: q.maxMarks })),
  );
  const answersJson = JSON.stringify(
    answers.map((a) => ({ id: a.id, claimedLabel: a.claimedLabel, text: a.text })),
  );
  const preMatchedJson = JSON.stringify(
    [...pre.byQuestion].map(([questionId, answerId]) => ({ questionId, answerId })),
  );

  const res = await client().models.generateContent({
    model: MODEL,
    contents: buildMappingPrompt(questionsJson, answersJson, preMatchedJson),
    config: {
      responseMimeType: "application/json",
      responseSchema: mappingSchema,
      temperature: 0,
    },
  });

  const parsed = parseJson<{ mappings: RawMapping[]; overallFeedback: string }>(
    res.text ?? "",
    "mapping answers to questions",
  );

  const byQuestionId = new Map((parsed.mappings ?? []).map((m) => [m.questionId, m]));
  const claimedAnswerIds = new Set<string>();

  const mapped: MappedQuestion[] = questions.map((question) => {
    const raw = byQuestionId.get(question.id);

    // The deterministic label match wins; the model only fills the gaps it left.
    const preAnswerId = pre.byQuestion.get(question.id);
    const answerId = preAnswerId ?? raw?.answerId ?? null;

    let answer: ExtractedAnswer | null = null;
    if (answerId && answersById.has(answerId) && !claimedAnswerIds.has(answerId)) {
      answer = answersById.get(answerId)!;
      claimedAnswerIds.add(answerId);
    }

    const maxScore = question.maxMarks ?? raw?.maxScore ?? 1;
    const grade: Grade = answer
      ? {
          score: clamp(raw?.score ?? 0, 0, maxScore),
          maxScore,
          verdict: raw?.verdict && raw.verdict !== "unanswered" ? raw.verdict : "partial",
          feedback: raw?.feedback?.trim() || "No feedback was generated for this answer.",
        }
      : {
          score: 0,
          maxScore,
          // An unanswered question is never "incorrect" - the teacher needs the
          // difference between "got it wrong" and "never attempted it".
          verdict: "unanswered",
          feedback: raw?.feedback?.trim() || "This question was left unanswered.",
        };

    return {
      question,
      answer,
      matchBasis: answer ? (preAnswerId ? "label" : (raw?.matchBasis ?? "content")) : "none",
      confidence: answer ? (preAnswerId ? 1 : clamp(raw?.confidence ?? 0.5, 0, 1)) : 0,
      grade,
    };
  });

  const unmatchedAnswers = answers.filter((a) => !claimedAnswerIds.has(a.id));
  const answeredCount = mapped.filter((m) => m.answer).length;

  return {
    mapped,
    unmatchedAnswers,
    summary: {
      totalQuestions: questions.length,
      answeredCount,
      unansweredCount: questions.length - answeredCount,
      unmatchedCount: unmatchedAnswers.length,
      totalScore: round(mapped.reduce((sum, m) => sum + m.grade.score, 0)),
      totalMaxScore: round(mapped.reduce((sum, m) => sum + m.grade.maxScore, 0)),
      overallFeedback: parsed.overallFeedback?.trim() || "",
    },
  };
}

function clamp(n: number, lo: number, hi: number): number {
  if (typeof n !== "number" || !isFinite(n)) return lo;
  return Math.min(hi, Math.max(lo, n));
}

function round(n: number): number {
  return Math.round(n * 100) / 100;
}
