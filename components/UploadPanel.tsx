"use client";

import { useRef, useState } from "react";

export interface UploadSlot {
  files: File[];
  pageCount: number | null;
}

interface Props {
  questionPaper: UploadSlot | null;
  answerSheet: UploadSlot | null;
  onPick: (which: "question" | "answer", files: File[]) => void;
  onClear: (which: "question" | "answer") => void;
  onStart: () => void;
  error: string | null;
}

const ACCEPT = "application/pdf,image/png,image/jpeg,image/webp";

export function UploadPanel({
  questionPaper,
  answerSheet,
  onPick,
  onClear,
  onStart,
  error,
}: Props) {
  const ready = Boolean(questionPaper && answerSheet);

  return (
    <div className="flex h-full flex-col items-center justify-center px-6 py-10">
      <h1 className="text-center text-[40px] leading-tight font-bold tracking-tight sm:text-[52px]">
        Upload{" "}
        <span className="rounded-md bg-brand-tint px-2 text-brand">
          Question Paper &amp; Answer Sheets
        </span>
      </h1>
      <p className="mt-3 text-center text-lg text-muted">Upload both files to get started</p>

      <div className="my-8 grid size-[150px] place-items-center rounded-full bg-brand-tint">
        <svg viewBox="0 0 24 24" fill="none" stroke="var(--color-brand)" strokeWidth="1.4" className="size-16" aria-hidden>
          <path d="M4 4.5A1.5 1.5 0 015.5 3H10a2 2 0 012 2 2 2 0 012-2h4.5A1.5 1.5 0 0120 4.5v13a1.5 1.5 0 01-1.5 1.5H14a2 2 0 00-2 2 2 2 0 00-2-2H5.5A1.5 1.5 0 014 17.5z" />
          <path d="M12 5v16" />
        </svg>
      </div>

      <div className="grid w-full max-w-[1100px] gap-6 rounded-[20px] bg-white/60 p-6 md:grid-cols-2">
        <Dropzone
          title="Question Paper"
          slot={questionPaper}
          onPick={(files) => onPick("question", files)}
          onClear={() => onClear("question")}
        />
        <Dropzone
          title="Answer Sheet"
          slot={answerSheet}
          onPick={(files) => onPick("answer", files)}
          onClear={() => onClear("answer")}
        />
      </div>

      {error && (
        <p
          role="alert"
          className="mt-6 max-w-[600px] rounded-xl bg-bad-tint px-4 py-3 text-center text-sm text-bad"
        >
          {error}
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        disabled={!ready}
        className="mt-8 inline-flex items-center gap-2 rounded-full bg-ink px-7 py-3.5 text-[15px] font-semibold text-white transition enabled:hover:bg-black disabled:cursor-not-allowed disabled:bg-[#c9c5c5]"
      >
        Start Mapping
        <span aria-hidden>→</span>
      </button>
      <p className="mt-3 text-sm text-faint">
        Once both files are uploaded, you&apos;ll be able to map answers with questions
      </p>
    </div>
  );
}

function Dropzone({
  title,
  slot,
  onPick,
  onClear,
}: {
  title: string;
  slot: UploadSlot | null;
  onPick: (files: File[]) => void;
  onClear: () => void;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = useState(false);

  function handleFiles(list: FileList | null) {
    if (!list?.length) return;
    onPick(Array.from(list));
  }

  if (slot) {
    const totalBytes = slot.files.reduce((sum, f) => sum + f.size, 0);
    const name =
      slot.files.length === 1 ? slot.files[0].name : `${slot.files.length} files`;

    return (
      <div className="flex min-h-[150px] items-center justify-center rounded-[16px] bg-white p-6 shadow-sm">
        <div className="relative flex w-full items-center gap-3 rounded-xl bg-canvas px-4 py-3">
          <span className="grid size-9 shrink-0 place-items-center rounded-md bg-bad-tint text-[10px] font-bold text-bad">
            {slot.files.length === 1 && /\.pdf$/i.test(slot.files[0].name) ? "PDF" : "IMG"}
          </span>
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold">{name}</p>
            <p className="text-xs text-muted">
              {formatBytes(totalBytes)}
              {slot.pageCount !== null && (
                <>
                  {" • "}
                  {slot.pageCount} {slot.pageCount === 1 ? "Page" : "Pages"}
                </>
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={onClear}
            aria-label={`Remove ${title}`}
            className="absolute -top-2 -right-2 grid size-6 place-items-center rounded-full bg-[#3a3a3a] text-white transition hover:bg-black"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" className="size-3" aria-hidden>
              <path d="M6 6l12 12M18 6L6 18" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => inputRef.current?.click()}
      onDragOver={(e) => {
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDragging(false);
        handleFiles(e.dataTransfer.files);
      }}
      className={`flex min-h-[150px] flex-col items-center justify-center gap-3 rounded-[16px] border-2 border-dashed bg-white p-6 text-center shadow-sm transition ${
        dragging ? "border-brand bg-brand-tint/40" : "border-line hover:border-faint"
      }`}
    >
      <span className="grid size-11 place-items-center rounded-full bg-canvas">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="size-5">
          <path d="M12 16V4M12 4L7 9M12 4l5 5" />
          <path d="M4 17v2a2 2 0 002 2h12a2 2 0 002-2v-2" />
        </svg>
      </span>
      <span className="text-lg font-semibold">
        Upload <span className="text-brand">{title}</span>
      </span>
      <span className="text-xs text-faint">PDF or images</span>
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT}
        multiple
        hidden
        onChange={(e) => {
          handleFiles(e.target.files);
          e.target.value = "";
        }}
      />
    </button>
  );
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
