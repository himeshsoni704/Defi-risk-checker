"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import BrandMark from "./BrandMark";
import { ALL_NAV, FLOW, OVERVIEW, REFERENCE, withWallet, type NavItem } from "./nav";
import { flowStatus } from "./flowState";
import { useAnalysis } from "@/lib/analysis-store";
import { useHealth } from "@/lib/queries";
import { API_BASE } from "@/lib/api";
import { shortAddress } from "@/lib/format";
import { useTour } from "@/components/tour/TourProvider";
import Icon from "@/components/ui/Icon";
import { WalletGlyph } from "@/components/ui/primitives";

function NavLink({ item, wallet, state, onNavigate }: { item: NavItem; wallet: string | null; state?: string; onNavigate: () => void }) {
  const pathname = usePathname();
  const current = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
  return (
    <Link
      href={item.flow ? withWallet(item.href, wallet) : item.href}
      className="nav-link"
      aria-current={current ? "page" : undefined}
      data-tour={item.tour}
      onClick={onNavigate}
    >
      {item.step ? <span className="nav-index">{item.step}</span> : <Icon name={item.icon} className="nav-icon" />}
      <span>{item.label}</span>
      {state ? <span className="nav-state" data-state={state} aria-hidden /> : <span />}
    </Link>
  );
}

function ApiStatus() {
  const health = useHealth();
  const up = Boolean(health.data) && !health.error;
  const down = Boolean(health.error);
  return (
    <div className="status-card" data-tour="api-status">
      <div className="status-row">
        <span className="row" style={{ gap: 8 }}>
          <span className={`dot ${up ? "dot-pos" : down ? "dot-neg" : "dot-warn dot-pulse"}`} />
          <strong>{up ? "API online" : down ? "API unreachable" : "Connecting…"}</strong>
        </span>
        {up && <span className="mono num">{health.data!.latencyMs} ms</span>}
      </div>
      {up && (
        <div className="status-row">
          <span>Proofs</span>
          <span className="mono" style={{ fontSize: 11 }}>
            {health.data!.web3.is_live_sepolia ? "Sepolia live" : "Simulated"}
          </span>
        </div>
      )}
      {down && (
        <div className="status-row" style={{ display: "block" }}>
          <span className="mono" style={{ fontSize: 11, overflowWrap: "anywhere" }}>
            {API_BASE}
          </span>
        </div>
      )}
    </div>
  );
}

export default function AppShell({ children }: { children: React.ReactNode }) {
  const [drawer, setDrawer] = useState(false);
  const pathname = usePathname();
  const { activeWallet, getRecord, hydrated } = useAnalysis();
  const tour = useTour();
  const status = flowStatus(getRecord(activeWallet));
  const current = ALL_NAV.find((n) => (n.href === "/" ? pathname === "/" : pathname.startsWith(n.href)));

  useEffect(() => setDrawer(false), [pathname]);

  useEffect(() => {
    if (!drawer) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawer(false);
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [drawer]);

  const close = () => setDrawer(false);

  return (
    <div className="app" data-drawer={drawer ? "open" : "closed"}>
      <div className="drawer-scrim" onClick={close} aria-hidden />
      <aside className="sidebar" aria-label="Main navigation">
        <Link href="/" className="brand" onClick={close}>
          <BrandMark />
          <span className="brand-name">
            DeFi Risk Checker
            <span className="brand-sub">QSVC · SHAP · Audit · Proof</span>
          </span>
        </Link>

        <nav className="nav-group">
          <div className="nav-label">Overview</div>
          {OVERVIEW.map((item) => (
            <NavLink key={item.href} item={item} wallet={activeWallet} onNavigate={close} />
          ))}
        </nav>

        <nav className="nav-group" data-tour="nav-flow" aria-label="Analysis flow">
          <div className="nav-label">Analysis flow</div>
          {FLOW.map((item) => (
            <NavLink
              key={item.href}
              item={item}
              wallet={activeWallet}
              state={hydrated && activeWallet ? status[item.flow!].state : undefined}
              onNavigate={close}
            />
          ))}
        </nav>

        <nav className="nav-group">
          <div className="nav-label">Reference</div>
          {REFERENCE.map((item) => (
            <NavLink key={item.href} item={item} wallet={activeWallet} onNavigate={close} />
          ))}
        </nav>

        <div className="sidebar-foot">
          <ApiStatus />
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          <button className="btn btn-ghost btn-icon menu-btn" onClick={() => setDrawer(true)} aria-label="Open navigation">
            <Icon name="menu" />
          </button>
          <div className="topbar-title">
            <strong>{current?.label ?? "DeFi Risk Checker"}</strong>
            {current?.step && <span className="hide-mobile mono">step {current.step} of 4</span>}
          </div>
          <div className="topbar-spacer" />
          {hydrated && activeWallet && (
            <Link href={withWallet("/assess", activeWallet)} className="btn btn-sm" title={`Active wallet ${activeWallet}`} data-tour="active-wallet">
              <WalletGlyph address={activeWallet} size={16} />
              <span className="mono">{shortAddress(activeWallet)}</span>
            </Link>
          )}
          <button className="btn btn-sm" onClick={tour.start} data-tour="tour-button">
            <Icon name="compass" />
            <span className="hide-mobile">Guided tour</span>
          </button>
        </header>
        {children}
        <footer className="footer">
          <span>Scores come from a QSVC trained on a synthetic 2,000-wallet dataset. Not financial advice.</span>
          <span className="mono">API {API_BASE}</span>
        </footer>
      </div>
    </div>
  );
}
