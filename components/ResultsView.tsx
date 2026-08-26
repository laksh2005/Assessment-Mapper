"use client";

import { useMemo, useState } from "react";
import { AnswerViewer } from "./AnswerViewer";
import { QuestionList } from "./QuestionList";
import type { AnalysisResult, ExtractedAnswer, PageImage } from "@/lib/types";

interface Props {
  result: AnalysisResult;
  answerPages: PageImage[];
  onReset: () => void;
}

type MobileTab = "questions" | "sheet";

export function ResultsView({ result, answerPages, onReset }: Props) {
  const [selectedId, setSelectedId] = useState<string | null>(
    result.mapped.find((m) => m.answer)?.question.id ?? result.mapped[0]?.question.id ?? null,
  );
  const [expandAll, setExpandAll] = useState(false);
  const [tab, setTab] = useState<MobileTab>("questions");

  /**
   * The selection can be either a question id or an unmatched-answer id; both
   * resolve to an answer to highlight.
   */
  const { activeAnswer, activeLabel } = useMemo((): {
    activeAnswer: ExtractedAnswer | null;
    activeLabel: string | null;
  } => {
    if (!selectedId) return { activeAnswer: null, activeLabel: null };

    const mapped = result.mapped.find((m) => m.question.id === selectedId);
    if (mapped) {
      return { activeAnswer: mapped.answer, activeLabel: mapped.question.label };
    }

    const unmatched = result.unmatchedAnswers.find((a) => a.id === selectedId);
    if (unmatched) {
      return { activeAnswer: unmatched, activeLabel: unmatched.claimedLabel ?? "?" };
    }

    return { activeAnswer: null, activeLabel: null };
  }, [selectedId, result]);

  function handleSelect(id: string) {
    setSelectedId(id);
    setTab("sheet");
  }

  const { summary } = result;
  const pct =
    summary.totalMaxScore > 0
      ? Math.round((summary.totalScore / summary.totalMaxScore) * 100)
      : 0;

  return (
    <div className="flex h-full min-h-0 flex-col gap-3">
      <header className="flex flex-wrap items-center justify-between gap-3 rounded-[16px] bg-white px-5 py-3 shadow-sm">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onReset}
            className="rounded-full border border-line px-3 py-1.5 text-sm text-muted transition hover:border-faint hover:text-ink"
          >
            ← New upload
          </button>
          <div>
            <p className="text-sm font-semibold">Grading summary</p>
            <p className="text-xs text-muted">
              {summary.answeredCount} of {summary.totalQuestions} questions answered
              {summary.unmatchedCount > 0 && ` • ${summary.unmatchedCount} unmatched`}
            </p>
          </div>
        </div>

        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-bold tabular-nums">
            {summary.totalScore}
            <span className="text-base font-medium text-muted">/{summary.totalMaxScore}</span>
          </span>
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
              pct >= 75
                ? "bg-ok-tint text-ok"
                : pct >= 40
                  ? "bg-warn-tint text-warn"
                  : "bg-bad-tint text-bad"
            }`}
          >
            {pct}%
          </span>
        </div>
      </header>

      {summary.overallFeedback && (
        <div className="rounded-[16px] bg-white px-5 py-3 shadow-sm">
          <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand-dark uppercase">
            Overall feedback
          </p>
          <p className="text-sm leading-relaxed text-ink/85">{summary.overallFeedback}</p>
        </div>
      )}

      {/* Mobile: the two panes become tabs, matching the design. */}
      <div className="flex gap-1 rounded-full bg-white p-1 shadow-sm lg:hidden">
        {(["questions", "sheet"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
              tab === t ? "bg-ink text-white" : "text-muted"
            }`}
          >
            {t === "questions" ? "Questions" : "Answer Sheet"}
          </button>
        ))}
      </div>

      <div className="grid min-h-0 flex-1 gap-3 lg:grid-cols-2">
        <section
          className={`min-h-0 overflow-hidden rounded-[16px] bg-white shadow-sm ${
            tab === "questions" ? "" : "hidden lg:block"
          }`}
        >
          <QuestionList
            result={result}
            selectedId={selectedId}
            onSelect={handleSelect}
            expandAll={expandAll}
            onToggleExpandAll={() => setExpandAll((v) => !v)}
          />
        </section>

        <section
          className={`min-h-0 overflow-hidden rounded-[16px] bg-white shadow-sm ${
            tab === "sheet" ? "" : "hidden lg:block"
          }`}
        >
          <AnswerViewer
            pages={answerPages}
            activeAnswer={activeAnswer}
            activeLabel={activeLabel}
          />
        </section>
      </div>
    </div>
  );
}
