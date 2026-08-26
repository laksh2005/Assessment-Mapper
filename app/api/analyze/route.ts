import { extractAnswers, extractQuestions, mapAndGrade } from "@/lib/gemini";
import type { AnalyzeEvent, PageImage } from "@/lib/types";

// The whole pipeline runs inside this one invocation. Three Gemini calls on a
// handful of pages typically lands well under a minute; 300s is the ceiling on
// plans that allow it and is clamped down automatically elsewhere.
export const maxDuration = 300;
export const runtime = "nodejs";

interface AnalyzeBody {
  questionPages: PageImage[];
  answerPages: PageImage[];
}

export async function POST(req: Request) {
  let body: AnalyzeBody;
  try {
    body = (await req.json()) as AnalyzeBody;
  } catch {
    return Response.json({ error: "Request body was not valid JSON." }, { status: 400 });
  }

  const { questionPages, answerPages } = body;
  if (!questionPages?.length || !answerPages?.length) {
    return Response.json(
      { error: "Both a question paper and an answer sheet are required." },
      { status: 400 },
    );
  }

  const encoder = new TextEncoder();

  const stream = new ReadableStream<Uint8Array>({
    async start(controller) {
      const send = (event: AnalyzeEvent) => {
        controller.enqueue(encoder.encode(JSON.stringify(event) + "\n"));
      };

      try {
        send({ type: "progress", stage: "Reading the question paper", pct: 10 });
        const questions = await extractQuestions(questionPages);

        if (questions.length === 0) {
          throw new Error(
            "No questions could be read from the question paper. Check that the pages are legible and right way up.",
          );
        }

        send({
          type: "progress",
          stage: `Found ${questions.length} questions - reading the answer sheet`,
          pct: 45,
        });
        const answers = await extractAnswers(answerPages);

        send({
          type: "progress",
          stage: `Found ${answers.length} answers - matching and grading`,
          pct: 75,
        });
        const result = await mapAndGrade(questions, answers);

        send({ type: "progress", stage: "Done", pct: 100 });
        send({ type: "result", result });
      } catch (err) {
        const message =
          err instanceof Error ? err.message : "Something went wrong during analysis.";
        send({ type: "error", message });
      } finally {
        controller.close();
      }
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson; charset=utf-8",
      "Cache-Control": "no-store, no-transform",
      // Defensive: some proxies buffer streamed responses without this.
      "X-Accel-Buffering": "no",
    },
  });
}
