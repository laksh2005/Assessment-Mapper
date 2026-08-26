"use client";

import type { AnalysisResult, ExtractedAnswer, MappedQuestion } from "@/lib/types";

interface Props {
  result: AnalysisResult;
  selectedId: string | null;
  onSelect: (id: string) => void;
  expandAll: boolean;
  onToggleExpandAll: () => void;
}

export function QuestionList({
  result,
  selectedId,
  onSelect,
  expandAll,
  onToggleExpandAll,
}: Props) {
  const { mapped, unmatchedAnswers, summary } = result;

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-3">
        <h2 className="text-sm font-semibold">Extracted Questions (from question paper)</h2>
        <button
          type="button"
          onClick={onToggleExpandAll}
          className="shrink-0 rounded-full border border-line px-3 py-1 text-xs font-medium text-muted transition hover:border-faint hover:text-ink"
        >
          {expandAll ? "Collapse All" : "Expand All"}
        </button>
      </header>

      <div className="flex flex-wrap gap-2 border-b border-line px-5 py-2.5 text-xs">
        <Stat label="Answered" value={summary.answeredCount} tone="ok" />
        <Stat label="Unanswered" value={summary.unansweredCount} tone="warn" />
        {summary.unmatchedCount > 0 && (
          <Stat label="Unmatched" value={summary.unmatchedCount} tone="bad" />
        )}
      </div>

      <div className="pane-scroll min-h-0 flex-1 overflow-y-auto px-4 py-4">
        <ul className="flex flex-col gap-3">
          {mapped.map((item) => (
            <li key={item.question.id}>
              <QuestionRow
                item={item}
                selected={selectedId === item.question.id}
                expanded={expandAll || selectedId === item.question.id}
                onSelect={() => onSelect(item.question.id)}
              />
            </li>
          ))}
        </ul>

        {unmatchedAnswers.length > 0 && (
          <section className="mt-6">
            <h3 className="px-1 text-xs font-semibold tracking-wide text-bad uppercase">
              Unmatched answers ({unmatchedAnswers.length})
            </h3>
            <p className="px-1 pt-1 pb-3 text-xs text-muted">
              Written on the sheet but not matching any question on this paper.
            </p>
            <ul className="flex flex-col gap-3">
              {unmatchedAnswers.map((answer) => (
                <li key={answer.id}>
                  <UnmatchedRow
                    answer={answer}
                    selected={selectedId === answer.id}
                    onSelect={() => onSelect(answer.id)}
                  />
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>
    </div>
  );
}

function QuestionRow({
  item,
  selected,
  expanded,
  onSelect,
}: {
  item: MappedQuestion;
  selected: boolean;
  expanded: boolean;
  onSelect: () => void;
}) {
  const { question, answer, grade, confidence, matchBasis } = item;
  const unanswered = !answer;
  const lowConfidence = Boolean(answer) && matchBasis === "content" && confidence < 0.6;

  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full rounded-[14px] border bg-white p-3.5 text-left transition ${
        selected
          ? "border-brand shadow-[0_0_0_3px_var(--color-brand-tint)]"
          : "border-line hover:border-faint"
      }`}
    >
      <div className="flex items-start gap-3">
        <span
          className={`grid size-7 shrink-0 place-items-center rounded-full text-xs font-bold ${
            selected ? "bg-brand text-white" : "bg-canvas text-muted"
          }`}
        >
          {question.order + 1}
        </span>

        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <p className="text-sm leading-snug font-medium text-ink">
              <span className="text-muted">{question.label}</span>{" "}
              {question.text}
            </p>
            <ScoreBadge grade={grade} />
          </div>

          <div className="mt-1.5 flex flex-wrap items-center gap-1.5">
            {unanswered && <Tag tone="warn">Unanswered</Tag>}
            {answer && matchBasis === "content" && <Tag tone="neutral">Matched by content</Tag>}
            {lowConfidence && <Tag tone="bad">Low confidence — verify</Tag>}
            {answer && answer.spans.length > 1 && (
              <Tag tone="neutral">Spans {answer.spans.length} pages</Tag>
            )}
            {answer && answer.spans.length > 0 && (
              <Tag tone="neutral">Page {answer.spans[0].pageIndex + 1}</Tag>
            )}
          </div>
        </div>
      </div>

      {expanded && (
        <div className="mt-3 flex flex-col gap-2 pl-10">
          {answer ? (
            <div className="rounded-xl bg-canvas p-3">
              <p className="mb-1 text-[11px] font-semibold tracking-wide text-muted uppercase">
                Student&apos;s answer
              </p>
              <p className="text-sm leading-relaxed whitespace-pre-wrap text-ink/85">
                {answer.text}
              </p>
            </div>
          ) : (
            <div className="rounded-xl border border-dashed border-line p-3 text-sm text-muted">
              No answer for this question was found on the sheet.
            </div>
          )}

          <div className="rounded-xl bg-brand-tint/60 p-3">
            <p className="mb-1 text-[11px] font-semibold tracking-wide text-brand-dark uppercase">
              AI Feedback
            </p>
            <p className="text-sm leading-relaxed text-ink/85">{grade.feedback}</p>
          </div>
        </div>
      )}
    </button>
  );
}

function UnmatchedRow({
  answer,
  selected,
  onSelect,
}: {
  answer: ExtractedAnswer;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      aria-current={selected}
      className={`w-full rounded-[14px] border bg-white p-3.5 text-left transition ${
        selected
          ? "border-bad shadow-[0_0_0_3px_var(--color-bad-tint)]"
          : "border-line hover:border-faint"
      }`}
    >
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">
          {answer.claimedLabel ? (
            <>
              Labelled <span className="text-bad">{answer.claimedLabel}</span>
            </>
          ) : (
            "Unlabelled answer"
          )}
        </p>
        {answer.spans.length > 0 && (
          <Tag tone="neutral">Page {answer.spans[0].pageIndex + 1}</Tag>
        )}
      </div>
      <p className="mt-1.5 line-clamp-3 text-sm text-muted">{answer.text}</p>
    </button>
  );
}

function ScoreBadge({ grade }: { grade: { score: number; maxScore: number; verdict: string } }) {
  const tone =
    grade.verdict === "correct"
      ? "bg-ok-tint text-ok"
      : grade.verdict === "unanswered"
        ? "bg-canvas text-faint"
        : grade.verdict === "incorrect"
          ? "bg-bad-tint text-bad"
          : "bg-warn-tint text-warn";

  return (
    <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${tone}`}>
      {grade.score}/{grade.maxScore}
    </span>
  );
}

function Tag({
  children,
  tone,
}: {
  children: React.ReactNode;
  tone: "ok" | "warn" | "bad" | "neutral";
}) {
  const cls = {
    ok: "bg-ok-tint text-ok",
    warn: "bg-warn-tint text-warn",
    bad: "bg-bad-tint text-bad",
    neutral: "bg-canvas text-muted",
  }[tone];
  return <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${cls}`}>{children}</span>;
}

function Stat({ label, value, tone }: { label: string; value: number; tone: "ok" | "warn" | "bad" }) {
  const cls = { ok: "text-ok", warn: "text-warn", bad: "text-bad" }[tone];
  return (
    <span className="rounded-full bg-canvas px-2.5 py-1">
      <span className={`font-semibold ${cls}`}>{value}</span>{" "}
      <span className="text-muted">{label}</span>
    </span>
  );
}
