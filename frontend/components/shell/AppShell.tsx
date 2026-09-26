"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { FLOW, withWallet } from "./nav";
import { flowStatus } from "./flowState";
import CommandPalette from "./CommandPalette";
import { useAnalysis } from "@/lib/analysis-store";
import { useHealth } from "@/lib/queries";
import { API_BASE } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import { useTour } from "@/components/tour/TourProvider";
import Icon from "@/components/ui/Icon";
import { WalletGlyph } from "@/components/ui/primitives";

function BrandMark() {
  // A risk dial with the deny notch at 50.
  return (
    <svg className="brand-mark" viewBox="0 0 28 28" aria-hidden>
      <rect x="0.5" y="0.5" width="27" height="27" rx="8" fill="#13161c" stroke="#2a303a" />
      <path d="M7 18.5a7 7 0 1 1 14 0" fill="none" stroke="#343b47" strokeWidth="2.2" strokeLinecap="round" />
      <path d="M7 18.5a7 7 0 0 1 9.2-6.65" fill="none" stroke="#8c7cff" strokeWidth="2.2" strokeLinecap="round" />
      <line x1="14" y1="9.3" x2="14" y2="12" stroke="#f2f3f5" strokeWidth="1.4" strokeLinecap="round" />
      <circle cx="14" cy="18.5" r="1.6" fill="#f2f3f5" />
    </svg>
  );
}

function FlowRail({ wallet, className }: { wallet: string | null; className?: string }) {
  const pathname = usePathname();
  const { getRecord, hydrated } = useAnalysis();
  const status = flowStatus(getRecord(wallet));
  return (
    <nav className={className ?? "rail"} aria-label="Analysis flow" data-tour={className ? undefined : "nav-flow"}>
      {FLOW.map((item, idx) => {
        const s = hydrated && wallet ? status[item.flow!].state : "idle";
        const current = pathname.startsWith(item.href);
        const prevDone = idx > 0 && hydrated && wallet && status[FLOW[idx - 1].flow!].state !== "idle";
        return (
          <span key={item.href} style={{ display: "contents" }}>
            {idx > 0 && !className && <span className="rail-link" style={{ "--fill": prevDone && s !== "idle" ? 1 : 0 } as React.CSSProperties} />}
            <Link href={withWallet(item.href, wallet)} className="rail-step" data-state={s} aria-current={current ? "page" : undefined} data-tour={className ? undefined : item.tour}>
              <span className="rail-num">{s === "done" && !current ? <Icon name="check" className="" /> : item.step}</span>
              {item.short ?? item.label}
            </Link>
          </span>
        );
      })}
    </nav>
  );
}

function StatusPill() {
  const health = useHealth();
  const up = Boolean(health.data) && !health.error;
  const down = Boolean(health.error);
  return (
    <span className="status-pill" data-tour="api-status" title={`API ${API_BASE}`}>
      <span className={`dot ${up ? "dot-good dot-live" : down ? "dot-bad" : "dot-warn"}`} />
      <span className="status-label">{up ? `API · ${health.data!.latencyMs} ms` : down ? "API offline" : "Connecting"}</span>
    </span>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const { activeWallet, hydrated } = useAnalysis();
  const tour = useTour();
  const [drawer, setDrawer] = useState(false);
  const [palette, setPalette] = useState(false);

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setPalette((p) => !p);
      }
      if (e.key === "Escape") setDrawer(false);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, []);

  const wallet = hydrated ? activeWallet : null;

  return (
    <>
      <header className="nav">
        <div className="nav-inner">
          <Link href="/" className="brand" aria-label="DeFi Risk Checker home">
            <BrandMark />
            <span className="brand-word">
              DeFi Risk <span>Checker</span>
            </span>
          </Link>

          <div className="nav-links">
            <Link href="/" className="nav-link" aria-current={pathname === "/" ? "page" : undefined} data-tour="nav-dashboard">
              Dashboard
            </Link>
            <FlowRail wallet={wallet} />
            <Link href="/models" className="nav-link" aria-current={pathname.startsWith("/models") ? "page" : undefined} data-tour="nav-models">
              Models
            </Link>
          </div>

          <div className="nav-spacer" />

          <div className="nav-tools">
            <button className="search-btn" onClick={() => setPalette(true)} data-tour="command" aria-label="Search wallets and pages">
              <Icon name="search" />
              <span className="search-label">Wallets, pages…</span>
              <span className="kbd">⌘K</span>
            </button>
            {wallet && (
              <Link href={withWallet("/assess", wallet)} className="btn btn-sm hide-md" title={`Active wallet ${wallet}`} data-tour="active-wallet" style={{ paddingLeft: 6 }}>
                <WalletGlyph address={wallet} size={20} />
                <span className="mono">{shortAddress(wallet)}</span>
              </Link>
            )}
            <StatusPill />
            <button className="btn btn-sm btn-icon" onClick={tour.start} data-tour="tour-button" aria-label="Start guided tour" title="Guided tour">
              <Icon name="compass" />
            </button>
            <button className="btn btn-sm btn-icon menu-toggle" onClick={() => setDrawer(true)} aria-label="Open menu">
              <Icon name="menu" />
            </button>
          </div>
        </div>
        <FlowRail wallet={wallet} className="mobile-rail" />
      </header>

      <div className="drawer" data-open={drawer ? "true" : "false"}>
        <div className="drawer-scrim" onClick={() => setDrawer(false)} />
        <div className="drawer-panel" role="dialog" aria-label="Menu">
          <div className="row between" style={{ marginBottom: 10 }}>
            <span className="brand-word">Menu</span>
            <button className="btn btn-ghost btn-sm btn-icon" onClick={() => setDrawer(false)} aria-label="Close menu">
              <Icon name="x" />
            </button>
          </div>
          <Link href="/" className="nav-link" aria-current={pathname === "/" ? "page" : undefined}>
            <Icon name="dashboard" className="" /> Dashboard
          </Link>
          {FLOW.map((f) => (
            <Link key={f.href} href={withWallet(f.href, wallet)} className="nav-link" aria-current={pathname.startsWith(f.href) ? "page" : undefined}>
              <span className="mono faint">{f.step}</span> {f.label}
            </Link>
          ))}
          <Link href="/models" className="nav-link" aria-current={pathname.startsWith("/models") ? "page" : undefined}>
            <Icon name="compare" className="" /> Model comparison
          </Link>
          <div style={{ marginTop: "auto" }} className="stack">
            <StatusPill />
            <span className="faint small mono" style={{ overflowWrap: "anywhere" }}>
              {API_BASE}
            </span>
          </div>
        </div>
      </div>

      <div key={pathname}>{children}</div>

      <footer className="footer">
        <div className="footer-inner">
          <span>Scores come from a QSVC trained on a synthetic 2,000-wallet dataset. Not financial advice.</span>
          <span className="mono">API {API_BASE}</span>
        </div>
      </footer>

      {palette && <CommandPalette onClose={() => setPalette(false)} />}
    </>
  );
}
