"use client";

export function LoadingState({ stage, pct }: { stage: string; pct: number }) {
  return (
    <div className="flex h-full flex-col items-center justify-center rounded-[20px] bg-white px-6 py-16 shadow-sm">
      <div className="relative mb-8 grid size-24 place-items-center">
        <SparkleBurst />
      </div>

      <h2 className="text-[32px] font-bold tracking-tight">Extracting…</h2>
      <p className="mt-1 text-muted">This may take a while</p>

      <div className="mt-8 w-full max-w-[420px]">
        <div
          className="h-2 w-full overflow-hidden rounded-full bg-canvas"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={stage}
        >
          <div
            className="h-full rounded-full bg-brand transition-[width] duration-500 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
        <p className="mt-3 text-center text-sm text-muted">{stage}</p>
      </div>
    </div>
  );
}

function SparkleBurst() {
  return (
    <svg viewBox="0 0 96 96" className="size-24" aria-hidden>
      <g fill="var(--color-brand)">
        <path d="M56 20l5.5 16.5L78 42l-16.5 5.5L56 64l-5.5-16.5L34 42l16.5-5.5L56 20z">
          <animate
            attributeName="opacity"
            values="1;0.45;1"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
        <path d="M30 52l3.2 9.3L42.5 65l-9.3 3.2L30 77.5l-3.2-9.3L17.5 65l9.3-3.2L30 52z">
          <animate
            attributeName="opacity"
            values="0.45;1;0.45"
            dur="1.6s"
            repeatCount="indefinite"
          />
        </path>
        <circle cx="74" cy="26" r="3.5">
          <animate
            attributeName="opacity"
            values="0.3;1;0.3"
            dur="2s"
            repeatCount="indefinite"
          />
        </circle>
      </g>
    </svg>
  );
}
