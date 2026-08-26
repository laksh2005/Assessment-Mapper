"use client";

const NAV = [
  { label: "Home", icon: GridIcon },
  { label: "My Classroom", icon: BoardIcon },
  { label: "Assignments", icon: DocIcon },
  { label: "Exams", icon: ClipboardIcon, active: true },
  { label: "My Library", icon: ClockIcon },
];

export function Sidebar({ collapsed = false }: { collapsed?: boolean }) {
  if (collapsed) {
    return (
      <aside className="hidden w-[68px] shrink-0 flex-col items-center gap-4 rounded-[20px] bg-white py-5 shadow-sm lg:flex">
        <Logo mark />
        <button
          type="button"
          className="grid size-10 place-items-center rounded-full bg-ink text-white ring-2 ring-brand"
          aria-label="AI Teacher's Toolkit"
        >
          <SparkIcon />
        </button>
        <nav className="flex flex-col items-center gap-3 pt-2">
          {NAV.map(({ label, icon: Icon, active }) => (
            <span
              key={label}
              title={label}
              className={`grid size-9 place-items-center rounded-lg ${
                active ? "bg-canvas text-ink" : "text-faint"
              }`}
            >
              <Icon />
            </span>
          ))}
        </nav>
        <span className="mt-auto text-faint">
          <GearIcon />
        </span>
      </aside>
    );
  }

  return (
    <aside className="hidden w-[304px] shrink-0 flex-col rounded-[20px] bg-white p-6 shadow-sm lg:flex">
      <Logo />

      <button
        type="button"
        className="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-ink px-4 py-3 text-sm font-semibold text-white ring-2 ring-brand transition hover:bg-black"
      >
        <SparkIcon />
        AI Teacher&apos;s Toolkit
      </button>

      <nav className="mt-6 flex flex-col gap-1">
        {NAV.map(({ label, icon: Icon, active }) => (
          <span
            key={label}
            className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[15px] ${
              active ? "bg-canvas font-medium text-ink" : "text-muted"
            }`}
          >
            <Icon />
            {label}
          </span>
        ))}
      </nav>

      <div className="mt-auto">
        <span className="flex items-center gap-3 px-3 text-[15px] text-muted">
          <GearIcon />
          Settings
        </span>
      </div>
    </aside>
  );
}

function Logo({ mark = false }: { mark?: boolean }) {
  return (
    <div className="flex items-center gap-2">
      <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-ink text-sm font-bold text-white">
        V
      </span>
      {!mark && <span className="text-xl font-bold tracking-tight">VedaAI</span>}
    </div>
  );
}

type IconProps = { className?: string };
const base = "size-[18px]";

function SparkIcon({ className = "size-4" }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className} aria-hidden>
      <path d="M12 2l1.9 5.6L19.5 9.5 13.9 11.4 12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" />
    </svg>
  );
}
function GridIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <rect x="3" y="3" width="7" height="7" rx="1.5" />
      <rect x="14" y="3" width="7" height="7" rx="1.5" />
      <rect x="3" y="14" width="7" height="7" rx="1.5" />
      <rect x="14" y="14" width="7" height="7" rx="1.5" />
    </svg>
  );
}
function BoardIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <rect x="3" y="4" width="18" height="13" rx="2" />
      <path d="M12 17v4M8 21h8" />
    </svg>
  );
}
function DocIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <path d="M14 3H7a2 2 0 00-2 2v14a2 2 0 002 2h10a2 2 0 002-2V8l-5-5z" />
      <path d="M14 3v5h5" />
    </svg>
  );
}
function ClipboardIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <path d="M9 4h6v3H9z" />
      <path d="M9 5.5H7a2 2 0 00-2 2V19a2 2 0 002 2h10a2 2 0 002-2V7.5a2 2 0 00-2-2h-2" />
    </svg>
  );
}
function ClockIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}
function GearIcon({ className = base }: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" className={className} aria-hidden>
      <circle cx="12" cy="12" r="3" />
      <path d="M19.4 15a1.7 1.7 0 00.3 1.9l.1.1a2 2 0 11-2.8 2.8l-.1-.1a1.7 1.7 0 00-1.9-.3 1.7 1.7 0 00-1 1.5V21a2 2 0 11-4 0v-.1A1.7 1.7 0 008.9 19a1.7 1.7 0 00-1.9.3l-.1.1a2 2 0 11-2.8-2.8l.1-.1a1.7 1.7 0 00.3-1.9 1.7 1.7 0 00-1.5-1H3a2 2 0 110-4h.1A1.7 1.7 0 004.6 8.9a1.7 1.7 0 00-.3-1.9l-.1-.1a2 2 0 112.8-2.8l.1.1a1.7 1.7 0 001.9.3H9a1.7 1.7 0 001-1.5V3a2 2 0 114 0v.1a1.7 1.7 0 001 1.5 1.7 1.7 0 001.9-.3l.1-.1a2 2 0 112.8 2.8l-.1.1a1.7 1.7 0 00-.3 1.9V9a1.7 1.7 0 001.5 1H21a2 2 0 110 4h-.1a1.7 1.7 0 00-1.5 1z" />
    </svg>
  );
}
