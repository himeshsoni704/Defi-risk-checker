"use client";

import { createContext, useCallback, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { usePathname, useRouter } from "next/navigation";
import { TOUR_STEPS, type TourRoute, type TourStep } from "./steps";
import { useAnalysis } from "@/lib/analysis-store";
import { api } from "@/lib/api";
import { fetchQuery } from "@/lib/query";
import { readStorage, writeStorage } from "@/lib/storage";
import Icon from "@/components/ui/Icon";

const SEEN_KEY = "drc.tour.seen.v1";

interface TourContextValue {
  active: boolean;
  start: () => void;
  stop: () => void;
}

const TourContext = createContext<TourContextValue | null>(null);

export function useTour() {
  const ctx = useContext(TourContext);
  if (!ctx) throw new Error("useTour must be used inside <TourProvider>");
  return ctx;
}

const ROUTE_PATH: Record<TourRoute, string> = {
  dashboard: "/",
  assess: "/assess",
  explain: "/explain",
  audit: "/audit",
  verify: "/verify",
  models: "/models",
};

export function TourProvider({ children }: { children: React.ReactNode }) {
  const [index, setIndex] = useState<number | null>(null);
  const router = useRouter();
  const pathname = usePathname();
  const { activeWallet, getRecord, running } = useAnalysis();
  const [tourWallet, setTourWallet] = useState<string | null>(null);

  const stop = useCallback(() => {
    setIndex(null);
    writeStorage(SEEN_KEY, true);
  }, []);

  const start = useCallback(() => {
    setTourWallet(null);
    setIndex(0);
  }, []);

  // First visit: offer the tour automatically on the dashboard.
  useEffect(() => {
    if (pathname !== "/") return;
    if (readStorage<boolean>(SEEN_KEY, false)) return;
    const t = setTimeout(() => setIndex((i) => (i === null ? 0 : i)), 900);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const step: TourStep | null = index !== null ? TOUR_STEPS[index] : null;

  // Resolve a wallet for the wallet-scoped part of the tour: the active wallet,
  // or the first sample wallet from the API.
  const resolveWallet = useCallback(async (): Promise<string | null> => {
    if (tourWallet) return tourWallet;
    if (activeWallet) {
      setTourWallet(activeWallet);
      return activeWallet;
    }
    try {
      const wallets = await fetchQuery("wallets:12", () => api.wallets(12));
      const w = wallets[0]?.wallet_address ?? null;
      setTourWallet(w);
      return w;
    } catch {
      return null;
    }
  }, [tourWallet, activeWallet]);

  // Navigate to the step's page.
  useEffect(() => {
    if (!step) return;
    let cancelled = false;
    (async () => {
      const base = ROUTE_PATH[step.route];
      if (step.route === "dashboard" || step.route === "models") {
        if (pathname !== base) router.push(base);
        return;
      }
      const wallet = await resolveWallet();
      if (cancelled) return;
      if (!wallet) {
        if (pathname !== base) router.push(base);
        return;
      }
      const needsRun = step.route === "assess" && !getRecord(wallet) && !running;
      const url = `${base}?wallet=${encodeURIComponent(wallet)}${needsRun ? "&run=1" : ""}`;
      const currentWallet = typeof window !== "undefined" ? new URLSearchParams(window.location.search).get("wallet") : null;
      if (pathname !== base || currentWallet?.toLowerCase() !== wallet.toLowerCase()) router.push(url);
    })();
    return () => {
      cancelled = true;
    };
    // Only react to step changes; pathname changes are caused by this effect.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [step?.id]);

  const next = useCallback(() => {
    setIndex((i) => {
      if (i === null) return null;
      if (i >= TOUR_STEPS.length - 1) {
        writeStorage(SEEN_KEY, true);
        return null;
      }
      return i + 1;
    });
  }, []);

  const back = useCallback(() => setIndex((i) => (i === null || i === 0 ? i : i - 1)), []);

  return (
    <TourContext.Provider value={{ active: index !== null, start, stop }}>
      {children}
      {step && index !== null && (
        <TourOverlay key={step.id} step={step} index={index} total={TOUR_STEPS.length} onNext={next} onBack={back} onClose={stop} />
      )}
    </TourContext.Provider>
  );
}

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

function TourOverlay({
  step,
  index,
  total,
  onNext,
  onBack,
  onClose,
}: {
  step: TourStep;
  index: number;
  total: number;
  onNext: () => void;
  onBack: () => void;
  onClose: () => void;
}) {
  const [rect, setRect] = useState<Rect | null>(null);
  const [gaveUp, setGaveUp] = useState(false);
  const [cardSize, setCardSize] = useState({ w: 380, h: 220 });
  const cardRef = useRef<HTMLDivElement>(null);
  const scrolledRef = useRef(false);

  // Track the target element every frame so the spotlight follows scrolling,
  // layout shifts and data arriving.
  useEffect(() => {
    if (!step.target) return;
    let raf = 0;
    const tick = () => {
      const el = document.querySelector<HTMLElement>(`[data-tour="${step.target}"]`);
      if (el) {
        const r = el.getBoundingClientRect();
        const visible = r.width > 0 && r.height > 0 && r.right > 0 && r.left < window.innerWidth;
        if (visible) {
          if (!scrolledRef.current) {
            scrolledRef.current = true;
            const fits = r.height < window.innerHeight - 160;
            el.scrollIntoView({ block: fits ? "center" : "start", behavior: "smooth" });
          }
          setRect((prev) =>
            prev && Math.abs(prev.top - r.top) < 0.5 && Math.abs(prev.left - r.left) < 0.5 && Math.abs(prev.width - r.width) < 0.5 && Math.abs(prev.height - r.height) < 0.5
              ? prev
              : { top: r.top, left: r.left, width: r.width, height: r.height },
          );
        } else {
          setRect(null);
        }
      } else {
        setRect(null);
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [step.target]);

  // Stop waiting for a target that never appears (API down, hidden on mobile).
  useEffect(() => {
    if (!step.target) return;
    const t = setTimeout(() => setGaveUp(true), step.waitText ? 20_000 : 2_500);
    return () => clearTimeout(t);
  }, [step.target, step.waitText]);

  useLayoutEffect(() => {
    const el = cardRef.current;
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (Math.abs(r.width - cardSize.w) > 1 || Math.abs(r.height - cardSize.h) > 1) setCardSize({ w: r.width, h: r.height });
  });

  useEffect(() => {
    cardRef.current?.focus({ preventScroll: true });
  }, []);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowRight") onNext();
      else if (e.key === "ArrowLeft") onBack();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onNext, onBack, onClose]);

  const waiting = Boolean(step.target) && !rect && !gaveUp;
  const missing = Boolean(step.target) && !rect && gaveUp;
  const pad = 6;
  const spot = rect ? { top: rect.top - pad, left: rect.left - pad, width: rect.width + pad * 2, height: rect.height + pad * 2 } : null;

  let cardPos: React.CSSProperties;
  if (spot && typeof window !== "undefined") {
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const gap = 14;
    const clampX = (x: number) => Math.max(16, Math.min(vw - cardSize.w - 16, x));
    const clampY = (y: number) => Math.max(16, Math.min(vh - cardSize.h - 16, y));
    if (spot.top + spot.height + gap + cardSize.h < vh - 8) {
      cardPos = { top: spot.top + spot.height + gap, left: clampX(spot.left) };
    } else if (spot.top - gap - cardSize.h > 8) {
      cardPos = { top: spot.top - gap - cardSize.h, left: clampX(spot.left) };
    } else if (spot.left + spot.width + gap + cardSize.w < vw - 8) {
      cardPos = { top: clampY(spot.top), left: spot.left + spot.width + gap };
    } else if (spot.left - gap - cardSize.w > 8) {
      cardPos = { top: clampY(spot.top), left: spot.left - gap - cardSize.w };
    } else {
      cardPos = { top: clampY(vh - cardSize.h - 24), left: clampX((vw - cardSize.w) / 2) };
    }
  } else {
    cardPos = {
      top: `calc(50% - ${cardSize.h / 2}px)`,
      left: `calc(50% - ${cardSize.w / 2}px)`,
    };
  }

  const last = index === total - 1;

  return (
    <div className="tour-layer" role="dialog" aria-modal="true" aria-labelledby="tour-title" aria-describedby="tour-text">
      <div className="tour-shade" onClick={(e) => e.stopPropagation()} />
      <div className="tour-spot" data-empty={spot ? "false" : "true"} style={spot ?? undefined} />
      <div className="tour-card" ref={cardRef} tabIndex={-1} style={cardPos}>
        <div className="tour-card-body">
          <div className="tour-step-count">
            <span>
              Step {index + 1} / {total}
            </span>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={onClose} aria-label="Close tour">
              <Icon name="x" />
            </button>
          </div>
          <h2 className="tour-title" id="tour-title">
            {step.title}
          </h2>
          <p className="tour-text" id="tour-text" aria-live="polite">
            {step.body}
          </p>
          {waiting && step.waitText && (
            <div className="tour-wait">
              <span className="spinner" /> {step.waitText}
            </div>
          )}
          {missing && (
            <div className="tour-wait">
              <Icon name="info" />
              This panel is not on screen right now. It appears once a wallet has been analyzed and the API is reachable.
            </div>
          )}
        </div>
        <div className="tour-progress" aria-hidden>
          <span style={{ width: `${((index + 1) / total) * 100}%` }} />
        </div>
        <div className="tour-actions">
          <span className="tour-kbd">
            <span className="kbd">←</span>
            <span className="kbd">→</span> move · <span className="kbd">esc</span> exit
          </span>
          <div className="row">
            {index > 0 && (
              <button className="btn btn-sm" onClick={onBack}>
                Back
              </button>
            )}
            <button className="btn btn-primary btn-sm" onClick={onNext}>
              {last ? "Finish" : index === 0 ? "Start tour" : "Next"}
              {!last && <Icon name="arrowRight" />}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
