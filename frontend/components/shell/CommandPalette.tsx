"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useAnalysis } from "@/lib/analysis-store";
import { useSampleWallets } from "@/lib/queries";
import { isEthAddress, shortAddress } from "@/lib/format";
import { FLOW, withWallet } from "./nav";
import Icon from "@/components/ui/Icon";
import { Tag, WalletGlyph } from "@/components/ui/primitives";
import { decisionTone } from "@/lib/verdicts";

interface Item {
  id: string;
  group: string;
  label: React.ReactNode;
  search: string;
  icon?: React.ReactNode;
  meta?: React.ReactNode;
  run: () => void;
}

/** ⌘K: jump to any page, a recent analysis, a dataset wallet, or analyze a pasted address. */
export default function CommandPalette({ onClose }: { onClose: () => void }) {
  const router = useRouter();
  const { history, activeWallet, getRecord } = useAnalysis();
  const samples = useSampleWallets(12);
  const [q, setQ] = useState("");
  const [sel, setSel] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => inputRef.current?.focus(), []);

  const go = (href: string) => {
    onClose();
    router.push(href);
  };

  const items = useMemo<Item[]>(() => {
    const out: Item[] = [];
    const query = q.trim();
    if (isEthAddress(query)) {
      out.push({
        id: "analyze",
        group: "Analyze",
        label: (
          <>
            Analyze <span className="mono">{shortAddress(query, 10, 6)}</span>
          </>
        ),
        search: query.toLowerCase(),
        icon: <WalletGlyph address={query} size={18} />,
        run: () => go(`/assess?wallet=${encodeURIComponent(query)}${getRecord(query) ? "" : "&run=1"}`),
      });
    }
    out.push({ id: "p-dash", group: "Pages", label: "Dashboard", search: "dashboard home overview", icon: <Icon name="dashboard" />, run: () => go("/") });
    for (const f of FLOW) {
      out.push({
        id: `p-${f.flow}`,
        group: "Pages",
        label: `${f.step} · ${f.label}`,
        search: `${f.label} ${f.flow}`.toLowerCase(),
        icon: <Icon name={f.icon} />,
        meta: activeWallet ? <span className="mono">{shortAddress(activeWallet)}</span> : undefined,
        run: () => go(withWallet(f.href, activeWallet)),
      });
    }
    out.push({ id: "p-models", group: "Pages", label: "Model comparison", search: "models compare xgboost svm qsvc", icon: <Icon name="compare" />, run: () => go("/models") });
    for (const r of history) {
      const w = r.score.wallet_address;
      out.push({
        id: `r-${w}`,
        group: "Recent analyses",
        label: <span className="mono">{shortAddress(w, 10, 6)}</span>,
        search: w.toLowerCase(),
        icon: <WalletGlyph address={w} size={18} />,
        meta: (
          <>
            <span className="mono">{r.score.risk_score.toFixed(1)}</span>
            <Tag tone={decisionTone(r.score.decision)}>{r.score.decision}</Tag>
          </>
        ),
        run: () => go(withWallet("/assess", w)),
      });
    }
    for (const s of samples.data ?? []) {
      if (history.some((h) => h.score.wallet_address.toLowerCase() === s.wallet_address.toLowerCase())) continue;
      out.push({
        id: `s-${s.wallet_address}`,
        group: "Dataset wallets",
        label: <span className="mono">{shortAddress(s.wallet_address, 10, 6)}</span>,
        search: `${s.wallet_address.toLowerCase()} ${s.label === 1 ? "risky" : "safe"}`,
        icon: <WalletGlyph address={s.wallet_address} size={18} />,
        meta: <span>labeled {s.label === 1 ? "risky" : "safe"}</span>,
        run: () => go(`/assess?wallet=${encodeURIComponent(s.wallet_address)}&run=1`),
      });
    }
    const needle = query.toLowerCase();
    return needle && !isEthAddress(query) ? out.filter((i) => i.search.includes(needle) || i.group.toLowerCase().includes(needle)) : out;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q, history, samples.data, activeWallet]);

  useEffect(() => setSel(0), [q]);

  useEffect(() => {
    listRef.current?.querySelector<HTMLElement>(`[data-idx="${sel}"]`)?.scrollIntoView({ block: "nearest" });
  }, [sel]);

  function onKey(e: React.KeyboardEvent) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setSel((s) => Math.min(items.length - 1, s + 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setSel((s) => Math.max(0, s - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      items[sel]?.run();
    } else if (e.key === "Escape") {
      onClose();
    }
  }

  let lastGroup = "";
  return (
    <div className="palette" role="dialog" aria-modal="true" aria-label="Command palette" onKeyDown={onKey}>
      <div className="palette-scrim" onClick={onClose} />
      <div className="palette-box">
        <div className="palette-input">
          <Icon name="search" />
          <input
            ref={inputRef}
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Paste a 0x address, or search pages and wallets"
            spellCheck={false}
            aria-label="Search"
          />
          <span className="kbd">esc</span>
        </div>
        <div className="palette-list" ref={listRef} role="listbox">
          {items.length === 0 && <div className="palette-group">No matches. Paste a full 0x address to analyze it.</div>}
          {items.map((it, idx) => {
            const header = it.group !== lastGroup ? <div className="palette-group">{it.group}</div> : null;
            lastGroup = it.group;
            return (
              <div key={it.id}>
                {header}
                <button
                  className="palette-item"
                  role="option"
                  aria-selected={idx === sel}
                  data-idx={idx}
                  onMouseMove={() => setSel(idx)}
                  onClick={it.run}
                >
                  {it.icon}
                  <span>{it.label}</span>
                  {it.meta && <span className="meta">{it.meta}</span>}
                </button>
              </div>
            );
          })}
        </div>
        <div className="palette-foot">
          <span>
            <span className="kbd">↑</span> <span className="kbd">↓</span> move
          </span>
          <span>
            <span className="kbd">↵</span> open
          </span>
        </div>
      </div>
    </div>
  );
}
