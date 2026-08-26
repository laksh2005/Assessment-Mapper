"use client";

import { useCallback, useState } from "react";
import { LoadingState } from "@/components/LoadingState";
import { ResultsView } from "@/components/ResultsView";
import { Sidebar } from "@/components/Sidebar";
import { UploadPanel, type UploadSlot } from "@/components/UploadPanel";
import { countPages, dataUrlBytes, filesToPageImages } from "@/lib/pdf";
import type { AnalysisResult, AnalyzeEvent, PageImage } from "@/lib/types";

/** Vercel's serverless request body ceiling, with headroom for JSON overhead. */
const MAX_PAYLOAD_BYTES = 4 * 1024 * 1024;

type Phase = "upload" | "working" | "results";

export default function Home() {
  const [phase, setPhase] = useState<Phase>("upload");
  const [questionPaper, setQuestionPaper] = useState<UploadSlot | null>(null);
  const [answerSheet, setAnswerSheet] = useState<UploadSlot | null>(null);
  const [progress, setProgress] = useState({ stage: "Starting", pct: 0 });
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [answerPages, setAnswerPages] = useState<PageImage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const handlePick = useCallback(async (which: "question" | "answer", files: File[]) => {
    setError(null);
    const slot: UploadSlot = { files, pageCount: null };
    if (which === "question") setQuestionPaper(slot);
    else setAnswerSheet(slot);

    // Page count is only for the file chip; failing to read it shouldn't block
    // the upload, since the real render happens at analysis time.
    try {
      const pageCount = await countPages(files);
      const withCount = { files, pageCount };
      if (which === "question") setQuestionPaper(withCount);
      else setAnswerSheet(withCount);
    } catch {
      /* leave pageCount null */
    }
  }, []);

  const handleClear = useCallback((which: "question" | "answer") => {
    if (which === "question") setQuestionPaper(null);
    else setAnswerSheet(null);
  }, []);

  const handleStart = useCallback(async () => {
    if (!questionPaper || !answerSheet) return;
    setError(null);
    setPhase("working");
    setProgress({ stage: "Rendering pages", pct: 4 });

    try {
      const qPages = await filesToPageImages(questionPaper.files);
      setProgress({ stage: "Rendering the answer sheet", pct: 8 });
      const aPages = await filesToPageImages(answerSheet.files);
      setAnswerPages(aPages);

      // Vercel rejects serverless request bodies over 4.5 MB. Fail here with an
      // explanation rather than letting the platform return an opaque 413.
      const payloadBytes = [...qPages, ...aPages].reduce(
        (sum, p) => sum + dataUrlBytes(p.dataUrl),
        0,
      );
      if (payloadBytes > MAX_PAYLOAD_BYTES) {
        throw new Error(
          `These files render to ${(payloadBytes / 1024 / 1024).toFixed(1)} MB of page images, ` +
            `over the ${(MAX_PAYLOAD_BYTES / 1024 / 1024).toFixed(1)} MB request limit. ` +
            `Try fewer pages at a time.`,
        );
      }

      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ questionPages: qPages, answerPages: aPages }),
      });

      if (!res.ok || !res.body) {
        const payload = await res.json().catch(() => null);
        throw new Error(payload?.error ?? `Analysis failed (HTTP ${res.status}).`);
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      let final: AnalysisResult | null = null;

      // NDJSON: one event per line, so a partial chunk is held until its
      // newline arrives.
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });

        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";

        for (const line of lines) {
          if (!line.trim()) continue;
          let event: AnalyzeEvent;
          try {
            event = JSON.parse(line) as AnalyzeEvent;
          } catch {
            continue;
          }

          if (event.type === "progress") {
            setProgress({ stage: event.stage, pct: event.pct });
          } else if (event.type === "result") {
            final = event.result;
          } else if (event.type === "error") {
            throw new Error(event.message);
          }
        }
      }

      if (!final) throw new Error("The analysis ended without returning a result.");
      setResult(final);
      setPhase("results");
    } catch (err) {
      console.error("[analyze] failed:", err);
      setError(err instanceof Error ? err.message : "Something went wrong.");
      setPhase("upload");
    }
  }, [questionPaper, answerSheet]);

  const handleReset = useCallback(() => {
    setPhase("upload");
    setResult(null);
    setAnswerPages([]);
    setQuestionPaper(null);
    setAnswerSheet(null);
    setError(null);
  }, []);

  return (
    <div className="flex h-dvh gap-3 p-3">
      <Sidebar collapsed={phase !== "upload"} />

      <main className="flex min-w-0 flex-1 flex-col">
        <TopBar />

        <div className="min-h-0 flex-1 pt-3">
          {phase === "upload" && (
            <div className="h-full overflow-y-auto rounded-[20px]">
              <UploadPanel
                questionPaper={questionPaper}
                answerSheet={answerSheet}
                onPick={handlePick}
                onClear={handleClear}
                onStart={handleStart}
                error={error}
              />
            </div>
          )}

          {phase === "working" && <LoadingState stage={progress.stage} pct={progress.pct} />}

          {phase === "results" && result && (
            <ResultsView result={result} answerPages={answerPages} onReset={handleReset} />
          )}
        </div>
      </main>
    </div>
  );
}

function TopBar() {
  return (
    <header className="flex items-center justify-between rounded-[16px] bg-white px-5 py-3 shadow-sm">
      <div className="flex items-center gap-2 text-sm font-medium text-muted">
        <span aria-hidden>←</span>
        <span aria-hidden>📋</span>
        Exams
      </div>
      <div className="flex items-center gap-3 text-muted">
        <span className="grid size-8 place-items-center rounded-full bg-canvas text-xs">?</span>
        <span className="grid size-8 place-items-center rounded-full bg-canvas text-xs">🔔</span>
        <span
          className="grid size-8 place-items-center rounded-full bg-brand-tint text-sm"
          aria-label="Account"
        >
          👤
        </span>
      </div>
    </header>
  );
}
