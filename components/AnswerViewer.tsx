"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { AnswerSpan, ExtractedAnswer, PageImage } from "@/lib/types";

interface Props {
  pages: PageImage[];
  /** The answer whose regions should be highlighted, if any. */
  activeAnswer: ExtractedAnswer | null;
  /** Label shown on the highlight badge, e.g. "Q3". */
  activeLabel: string | null;
}

const ZOOM_STEPS = [0.5, 0.75, 1, 1.25, 1.5, 2];

export function AnswerViewer({ pages, activeAnswer, activeLabel }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);
  const pageRefs = useRef<(HTMLDivElement | null)[]>([]);
  const [zoomIndex, setZoomIndex] = useState(2);
  const [visiblePage, setVisiblePage] = useState(0);
  /** Bumped as each page image loads, so scroll math waits for real layout. */
  const [loadedCount, setLoadedCount] = useState(0);

  const zoom = ZOOM_STEPS[zoomIndex];

  /** pageIndex -> spans of the active answer on that page. */
  const spansByPage = useMemo(() => {
    const map = new Map<number, AnswerSpan[]>();
    for (const span of activeAnswer?.spans ?? []) {
      const list = map.get(span.pageIndex);
      if (list) list.push(span);
      else map.set(span.pageIndex, [span]);
    }
    return map;
  }, [activeAnswer]);

  // Bring the first highlighted region into view when the selection changes.
  //
  // Runs again once `loadedCount` changes: on first render the page images have
  // no layout yet, so an early scroll would compute against a zero-height page.
  useEffect(() => {
    const first = activeAnswer?.spans[0];
    if (!first) return;
    const pageEl = pageRefs.current[first.pageIndex];
    const scroller = scrollRef.current;
    if (!pageEl || !scroller) return;

    const pageTop = offsetWithin(scroller, pageEl);
    const pageHeight = pageEl.getBoundingClientRect().height;
    if (pageHeight === 0) return; // images not laid out yet; a later pass handles it

    // Offset into the page by the box's own vertical position, so the highlight
    // lands near the top of the viewport rather than the page's top edge.
    const target = pageTop + first.box.y * pageHeight - scroller.clientHeight * 0.2;
    scroller.scrollTo({ top: Math.max(0, target), behavior: "smooth" });
  }, [activeAnswer, loadedCount, zoom]);

  // Track which page is centred, for the page counter.
  useEffect(() => {
    const scroller = scrollRef.current;
    if (!scroller) return;

    function onScroll() {
      const el = scrollRef.current;
      if (!el) return;
      const mid = el.scrollTop + el.clientHeight / 2;
      let current = 0;
      pageRefs.current.forEach((page, i) => {
        if (page && offsetWithin(el, page) <= mid) current = i;
      });
      setVisiblePage(current);
    }

    scroller.addEventListener("scroll", onScroll, { passive: true });
    return () => scroller.removeEventListener("scroll", onScroll);
  }, []);

  function goToPage(index: number) {
    const clamped = Math.min(Math.max(0, index), pages.length - 1);
    const pageEl = pageRefs.current[clamped];
    const scroller = scrollRef.current;
    if (!pageEl || !scroller) return;
    scroller.scrollTo({ top: Math.max(0, offsetWithin(scroller, pageEl) - 12), behavior: "smooth" });
  }

  return (
    <div className="flex h-full min-h-0 flex-col">
      <header className="flex items-center justify-between gap-3 border-b border-line px-5 py-2.5">
        <h2 className="text-sm font-semibold">Answer Sheet</h2>

        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1 rounded-full bg-canvas px-1 py-0.5">
            <IconButton
              label="Zoom out"
              disabled={zoomIndex === 0}
              onClick={() => setZoomIndex((i) => Math.max(0, i - 1))}
            >
              −
            </IconButton>
            <span className="min-w-[46px] text-center text-xs font-medium tabular-nums">
              {Math.round(zoom * 100)}%
            </span>
            <IconButton
              label="Zoom in"
              disabled={zoomIndex === ZOOM_STEPS.length - 1}
              onClick={() => setZoomIndex((i) => Math.min(ZOOM_STEPS.length - 1, i + 1))}
            >
              +
            </IconButton>
          </div>

          <div className="flex items-center gap-1 rounded-full bg-canvas px-1 py-0.5">
            <IconButton
              label="Previous page"
              disabled={visiblePage === 0}
              onClick={() => goToPage(visiblePage - 1)}
            >
              ‹
            </IconButton>
            <span className="min-w-[86px] text-center text-xs font-medium tabular-nums">
              Page {visiblePage + 1} of {pages.length}
            </span>
            <IconButton
              label="Next page"
              disabled={visiblePage >= pages.length - 1}
              onClick={() => goToPage(visiblePage + 1)}
            >
              ›
            </IconButton>
          </div>
        </div>
      </header>

      <div ref={scrollRef} className="pane-scroll min-h-0 flex-1 overflow-auto bg-canvas p-4">
        <div className="mx-auto flex flex-col items-center gap-6" style={{ width: `${zoom * 100}%` }}>
          {pages.map((page, i) => {
            const spans = spansByPage.get(i) ?? [];
            return (
              <div
                key={page.pageIndex}
                ref={(el) => {
                  pageRefs.current[i] = el;
                }}
                className="relative w-full overflow-hidden rounded-lg bg-white shadow-sm"
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={page.dataUrl}
                  alt={`Answer sheet page ${i + 1}`}
                  className="block w-full select-none"
                  draggable={false}
                  onLoad={() => setLoadedCount((n) => n + 1)}
                />

                {/* Highlights sit in the same fractional space as the bitmap, so
                    they stay aligned at any zoom or container width. */}
                {spans.map((span, si) => (
                  <div
                    key={si}
                    className="highlight-active pointer-events-none absolute rounded-md border-2 border-ok bg-ok/12"
                    style={{
                      left: `${span.box.x * 100}%`,
                      top: `${span.box.y * 100}%`,
                      width: `${span.box.w * 100}%`,
                      height: `${span.box.h * 100}%`,
                    }}
                  >
                    {activeLabel && (
                      <span className="absolute -top-px -left-px rounded-tl-md rounded-br-md bg-ok px-1.5 py-0.5 text-[10px] leading-none font-bold text-white">
                        {activeLabel}
                        {spans.length > 1 || (activeAnswer?.spans.length ?? 0) > 1
                          ? ` (${indexOfSpan(activeAnswer, span) + 1}/${activeAnswer?.spans.length})`
                          : ""}
                      </span>
                    )}
                  </div>
                ))}

                <span className="absolute right-2 bottom-2 rounded-full bg-black/45 px-2 py-0.5 text-[10px] font-medium text-white">
                  {i + 1}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/**
 * Vertical offset of `el` inside scroll container `scroller`, in the
 * container's scroll coordinates.
 *
 * `offsetTop` can't be used here: it is measured against the nearest positioned
 * ancestor, which is not the scroller, so it silently returns the wrong origin
 * and the viewer scrolls to the wrong place (or appears not to scroll at all).
 */
function offsetWithin(scroller: HTMLElement, el: HTMLElement): number {
  return el.getBoundingClientRect().top - scroller.getBoundingClientRect().top + scroller.scrollTop;
}

function indexOfSpan(answer: ExtractedAnswer | null, span: AnswerSpan): number {
  if (!answer) return 0;
  return answer.spans.indexOf(span);
}

function IconButton({
  children,
  label,
  onClick,
  disabled,
}: {
  children: React.ReactNode;
  label: string;
  onClick: () => void;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-6 place-items-center rounded-full text-sm text-muted transition enabled:hover:bg-white enabled:hover:text-ink disabled:opacity-35"
    >
      {children}
    </button>
  );
}
