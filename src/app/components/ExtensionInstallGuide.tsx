"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react";
import { createPortal } from "react-dom";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  MousePointerClick,
  X,
} from "lucide-react";
import { cn } from "./ui/utils";

type GuideTargetRef = {
  current: Element | null;
};

export type ExtensionInstallGuideStep = {
  id: string;
  title: string;
  body: string;
  note?: string;
  actionLabel?: string;
  actionDisabled?: boolean;
  targetRef: GuideTargetRef;
};

type ExtensionInstallGuideProps = {
  open: boolean;
  steps: ExtensionInstallGuideStep[];
  currentStepIndex: number;
  completedStepIds: string[];
  onClose: () => void;
  onNext: () => void;
  onPrevious: () => void;
  onStepDone: () => void;
  onJumpToStep: (index: number) => void;
  onStepAction?: (step: ExtensionInstallGuideStep) => void | Promise<void>;
};

type RectState = {
  top: number;
  left: number;
  right: number;
  bottom: number;
  width: number;
  height: number;
};

type SizeState = {
  width: number;
  height: number;
};

const VIEWPORT_MARGIN = 12;
const HIGHLIGHT_PADDING = 10;

function clamp(value: number, min: number, max: number) {
  return Math.min(Math.max(value, min), max);
}

function toRectState(element: Element | null): RectState | null {
  if (!element) return null;
  const rect = element.getBoundingClientRect();
  if (!rect.width && !rect.height) return null;
  return {
    top: rect.top,
    left: rect.left,
    right: rect.right,
    bottom: rect.bottom,
    width: rect.width,
    height: rect.height,
  };
}

export function ExtensionInstallGuide({
  open,
  steps,
  currentStepIndex,
  completedStepIds,
  onClose,
  onNext,
  onPrevious,
  onStepDone,
  onJumpToStep,
  onStepAction,
}: ExtensionInstallGuideProps) {
  const panelRef = useRef<HTMLDivElement | null>(null);
  const [panelSize, setPanelSize] = useState<SizeState>({ width: 340, height: 280 });
  const [viewport, setViewport] = useState<SizeState>({ width: 0, height: 0 });
  const [activeRect, setActiveRect] = useState<RectState | null>(null);

  const activeStep = steps[currentStepIndex] || null;
  const completedSet = useMemo(() => new Set(completedStepIds), [completedStepIds]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;
    const update = () => {
      setViewport({ width: window.innerWidth, height: window.innerHeight });
      setActiveRect(toRectState(activeStep?.targetRef.current || null));
    };

    const handleFrame = () => {
      window.requestAnimationFrame(update);
    };

    update();
    window.addEventListener("resize", handleFrame);
    window.addEventListener("scroll", handleFrame, true);

    return () => {
      window.removeEventListener("resize", handleFrame);
      window.removeEventListener("scroll", handleFrame, true);
    };
  }, [activeStep, open]);

  useEffect(() => {
    if (!open) return;
    const target = activeStep?.targetRef.current;
    if (!target) return;
    target.scrollIntoView({
      block: "center",
      inline: "center",
      behavior: "smooth",
    });
  }, [activeStep, open]);

  useEffect(() => {
    if (!open || !panelRef.current) return;
    const panel = panelRef.current;

    const update = () => {
      setPanelSize({
        width: panel.offsetWidth,
        height: panel.offsetHeight,
      });
    };

    update();

    if (typeof ResizeObserver === "undefined") return;

    const observer = new ResizeObserver(() => update());
    observer.observe(panel);
    return () => observer.disconnect();
  }, [activeStep, open]);

  useEffect(() => {
    if (!open || typeof window === "undefined") return;

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
      }
      if (event.key === "ArrowLeft") {
        onPrevious();
      }
      if (event.key === "ArrowRight") {
        onNext();
      }
    };

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [onClose, onNext, onPrevious, open]);

  if (!open || !activeStep || typeof document === "undefined") return null;

  const safeViewportWidth = viewport.width || window.innerWidth;
  const safeViewportHeight = viewport.height || window.innerHeight;
  const compactMode = safeViewportWidth < 640 || safeViewportHeight < 760;
  const panelWidth = compactMode
    ? Math.min(Math.max(280, safeViewportWidth - VIEWPORT_MARGIN * 2), 320)
    : Math.min(panelSize.width || 340, Math.max(280, safeViewportWidth - VIEWPORT_MARGIN * 2));
  const maxPanelHeight = compactMode
    ? Math.max(240, safeViewportHeight - VIEWPORT_MARGIN * 2)
    : Math.max(260, safeViewportHeight - VIEWPORT_MARGIN * 2);
  const panelHeight = Math.min(panelSize.height || 280, maxPanelHeight);
  const targetCenterX = activeRect ? activeRect.left + activeRect.width / 2 : safeViewportWidth / 2;
  const preferredAbove = !compactMode && Boolean(activeRect && activeRect.top > safeViewportHeight * 0.56);
  const left = clamp(
    compactMode ? safeViewportWidth - panelWidth - VIEWPORT_MARGIN : targetCenterX - panelWidth / 2,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, safeViewportWidth - panelWidth - VIEWPORT_MARGIN),
  );
  const top = clamp(
    compactMode
      ? safeViewportHeight - panelHeight - VIEWPORT_MARGIN
      : activeRect
      ? preferredAbove
        ? activeRect.top - panelHeight - 18
        : activeRect.bottom + 18
      : safeViewportHeight / 2 - panelHeight / 2,
    VIEWPORT_MARGIN,
    Math.max(VIEWPORT_MARGIN, safeViewportHeight - panelHeight - VIEWPORT_MARGIN),
  );
  const arrowAtTop = !preferredAbove;
  const arrowLeft = clamp(targetCenterX - left - 9, 24, panelWidth - 24);
  const progressPercent = ((currentStepIndex + 1) / Math.max(steps.length, 1)) * 100;
  const completedPercent = (completedStepIds.length / Math.max(steps.length, 1)) * 100;

  const highlightStyle: CSSProperties | undefined = activeRect
    ? {
        top: Math.max(activeRect.top - HIGHLIGHT_PADDING, 0),
        left: Math.max(activeRect.left - HIGHLIGHT_PADDING, 0),
        width: activeRect.width + HIGHLIGHT_PADDING * 2,
        height: activeRect.height + HIGHLIGHT_PADDING * 2,
      }
    : undefined;

  const maskSegments: Array<CSSProperties> = activeRect
    ? [
        {
          top: 0,
          left: 0,
          width: "100%",
          height: Math.max(activeRect.top - HIGHLIGHT_PADDING, 0),
        },
        {
          top: Math.max(activeRect.top - HIGHLIGHT_PADDING, 0),
          left: 0,
          width: Math.max(activeRect.left - HIGHLIGHT_PADDING, 0),
          height: activeRect.height + HIGHLIGHT_PADDING * 2,
        },
        {
          top: Math.max(activeRect.top - HIGHLIGHT_PADDING, 0),
          left: activeRect.right + HIGHLIGHT_PADDING,
          width: Math.max(safeViewportWidth - activeRect.right - HIGHLIGHT_PADDING, 0),
          height: activeRect.height + HIGHLIGHT_PADDING * 2,
        },
        {
          top: activeRect.bottom + HIGHLIGHT_PADDING,
          left: 0,
          width: "100%",
          height: Math.max(safeViewportHeight - activeRect.bottom - HIGHLIGHT_PADDING, 0),
        },
      ]
    : [
        {
          inset: 0,
        },
      ];

  return createPortal(
    <div className="fixed inset-0 z-[140]">
      {maskSegments.map((style, index) => (
        <div
          key={index}
          className="pointer-events-none fixed bg-slate-950/60 backdrop-blur-[1px]"
          style={style}
        />
      ))}

      {highlightStyle ? (
        <div
          className="pointer-events-none fixed rounded-3xl border-2 border-sky-400 shadow-[0_0_0_4px_rgba(14,165,233,0.16)] transition-all duration-200"
          style={highlightStyle}
        />
      ) : null}

      <div
        ref={panelRef}
        className="pointer-events-auto fixed z-[141] overflow-y-auto overscroll-contain rounded-[20px] border border-sky-100 bg-white/98 p-3.5 shadow-[0_24px_80px_rgba(15,23,42,0.26)]"
        style={{ top, left, maxHeight: maxPanelHeight }}
      >
        {!compactMode ? (
          <div
            className={cn(
              "absolute h-[16px] w-[16px] rotate-45 border border-sky-100 bg-white",
              arrowAtTop ? "-top-[8px]" : "-bottom-[8px]",
            )}
            style={{ left: arrowLeft }}
          />
        ) : null}

        <div className="relative">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-[0.22em] text-sky-600">
                Guided Install
              </div>
              <h3 className="mt-1 text-base font-bold text-slate-900">{activeStep.title}</h3>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-full border border-slate-200 p-1.5 text-slate-500 transition-colors hover:border-slate-300 hover:text-slate-800"
              aria-label="Close install guide"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="mt-3 rounded-xl border border-slate-100 bg-slate-50 px-2.5 py-2">
            <div className="flex items-center justify-between text-xs font-semibold text-slate-600">
              <span>
                Step {currentStepIndex + 1} of {steps.length}
              </span>
              <span>{Math.round(completedPercent)}% marked done</span>
            </div>
            <div className="mt-2 h-2 rounded-full bg-slate-200">
              <div
                className="h-2 rounded-full bg-sky-500 transition-all"
                style={{ width: `${progressPercent}%` }}
              />
            </div>
          </div>

          <div className="mt-3 flex flex-wrap gap-1.5">
            {steps.map((step, index) => {
              const isActive = index === currentStepIndex;
              const isDone = completedSet.has(step.id);
              return (
                <button
                  key={step.id}
                  type="button"
                  onClick={() => onJumpToStep(index)}
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold transition-colors",
                    isActive && "border-sky-300 bg-sky-50 text-sky-700",
                    !isActive && isDone && "border-emerald-200 bg-emerald-50 text-emerald-700",
                    !isActive && !isDone && "border-slate-200 bg-white text-slate-500 hover:border-slate-300 hover:text-slate-700",
                  )}
                >
                  {isDone ? <CheckCircle2 className="h-3.5 w-3.5" /> : <span>{index + 1}</span>}
                  <span className="max-w-[6rem] truncate">{step.title}</span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-sm leading-5 text-slate-700">{activeStep.body}</p>

          {activeStep.note ? (
            <div className="mt-3 rounded-xl border border-sky-100 bg-sky-50 px-2.5 py-2.5 text-xs leading-5 text-sky-900">
              {activeStep.note}
            </div>
          ) : null}

          <div className="mt-3 flex items-start gap-2.5 rounded-xl border border-amber-200 bg-amber-50 px-2.5 py-2.5 text-sm text-amber-900">
            <MousePointerClick className="mt-0.5 h-4 w-4 shrink-0" />
            <div>Did you finish this step? Click Step done, or use Next to review first.</div>
          </div>

          {activeStep.actionLabel && onStepAction ? (
            <div className="mt-3">
              <button
                type="button"
                onClick={() => void onStepAction(activeStep)}
                disabled={activeStep.actionDisabled}
                className="inline-flex items-center justify-center rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {activeStep.actionLabel}
              </button>
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2">
            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onPrevious}
                disabled={currentStepIndex === 0}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <ArrowLeft className="h-4 w-4" />
                Previous
              </button>
              <button
                type="button"
                onClick={onNext}
                disabled={currentStepIndex === steps.length - 1}
                className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
              >
                Next
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="rounded-xl border border-slate-200 px-2.5 py-2 text-sm font-semibold text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-50"
              >
                Close guide
              </button>
              <button
                type="button"
                onClick={onStepDone}
                className="rounded-xl bg-sky-600 px-3.5 py-2 text-sm font-semibold text-white transition-colors hover:bg-sky-700"
              >
                {currentStepIndex === steps.length - 1 ? "Done" : "Step done"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>,
    document.body,
  );
}
