"use client";

// App-wide analysis state: the active wallet, the score results produced in
// this browser, and the in-flight analysis. Results are kept in localStorage so
// a reload or a shared session keeps the "Recent analyses" list; the backend
// stays the source of truth for explanations, audits and on-chain state.

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import { api, errorMessage } from "./api";
import { invalidateQueries } from "./query";
import { readStorage, writeStorage, removeStorage } from "./storage";
import type { AnchorResponse, ScoreResponse, WalletFeatures } from "./types";

export interface WalletRecord {
  score: ScoreResponse;
  /** Browser time (ms) when the score came back. */
  scoredAt: number;
  durationMs: number;
  customFeatures: boolean;
  /** Receipt from POST /verify, when anchored from this browser. */
  anchor?: AnchorResponse;
}

export interface AnalysisRun {
  wallet: string;
  startedAt: number;
  custom: boolean;
}

interface AnalysisContextValue {
  hydrated: boolean;
  activeWallet: string | null;
  setActiveWallet: (wallet: string | null) => void;
  records: Record<string, WalletRecord>;
  history: WalletRecord[];
  getRecord: (wallet: string | null | undefined) => WalletRecord | undefined;
  running: AnalysisRun | null;
  lastError: { wallet: string; message: string } | null;
  analyze: (wallet: string, features?: Partial<WalletFeatures>) => Promise<ScoreResponse | null>;
  saveAnchor: (wallet: string, anchor: AnchorResponse) => void;
  clearHistory: () => void;
}

const RECORDS_KEY = "drc.records.v1";
const ACTIVE_KEY = "drc.active.v1";
const MAX_RECORDS = 12;

const AnalysisContext = createContext<AnalysisContextValue | null>(null);

export const walletKey = (wallet: string) => wallet.trim().toLowerCase();

export function AnalysisProvider({ children }: { children: React.ReactNode }) {
  const [hydrated, setHydrated] = useState(false);
  const [activeWallet, setActive] = useState<string | null>(null);
  const [records, setRecords] = useState<Record<string, WalletRecord>>({});
  const [running, setRunning] = useState<AnalysisRun | null>(null);
  const [lastError, setLastError] = useState<{ wallet: string; message: string } | null>(null);
  const runningRef = useRef<Promise<ScoreResponse | null> | null>(null);

  useEffect(() => {
    setRecords(readStorage<Record<string, WalletRecord>>(RECORDS_KEY, {}));
    setActive(readStorage<string | null>(ACTIVE_KEY, null));
    setHydrated(true);
  }, []);

  const persist = useCallback((next: Record<string, WalletRecord>) => {
    const trimmed = Object.fromEntries(
      Object.entries(next)
        .sort(([, a], [, b]) => b.scoredAt - a.scoredAt)
        .slice(0, MAX_RECORDS),
    );
    writeStorage(RECORDS_KEY, trimmed);
    return trimmed;
  }, []);

  const setActiveWallet = useCallback((wallet: string | null) => {
    const value = wallet?.trim() || null;
    setActive(value);
    if (value) writeStorage(ACTIVE_KEY, value);
    else removeStorage(ACTIVE_KEY);
  }, []);

  const analyze = useCallback(
    async (wallet: string, features?: Partial<WalletFeatures>) => {
      const address = wallet.trim();
      if (!address) return null;
      if (runningRef.current) return runningRef.current;

      const startedAt = Date.now();
      setRunning({ wallet: address, startedAt, custom: Boolean(features) });
      setLastError(null);
      setActiveWallet(address);

      const job = (async () => {
        try {
          const score = await api.score(address, features);
          const key = walletKey(address);
          // A new score produces a new canonical record and hash, so any cached
          // explanation, audit or verification for this wallet is stale.
          invalidateQueries((k) => k.endsWith(`:${key}`) || k === "health");
          setRecords((prev) =>
            persist({
              ...prev,
              [key]: {
                score,
                scoredAt: Date.now(),
                durationMs: Date.now() - startedAt,
                customFeatures: Boolean(features),
              },
            }),
          );
          return score;
        } catch (err) {
          setLastError({ wallet: address, message: errorMessage(err) });
          return null;
        } finally {
          setRunning(null);
          runningRef.current = null;
        }
      })();
      runningRef.current = job;
      return job;
    },
    [persist, setActiveWallet],
  );

  const saveAnchor = useCallback(
    (wallet: string, anchor: AnchorResponse) => {
      const key = walletKey(wallet);
      setRecords((prev) => {
        if (!prev[key]) return prev;
        return persist({ ...prev, [key]: { ...prev[key], anchor } });
      });
    },
    [persist],
  );

  const clearHistory = useCallback(() => {
    setRecords({});
    removeStorage(RECORDS_KEY);
  }, []);

  const getRecord = useCallback(
    (wallet: string | null | undefined) => (wallet ? records[walletKey(wallet)] : undefined),
    [records],
  );

  const history = useMemo(
    () => Object.values(records).sort((a, b) => b.scoredAt - a.scoredAt),
    [records],
  );

  const value = useMemo<AnalysisContextValue>(
    () => ({
      hydrated,
      activeWallet,
      setActiveWallet,
      records,
      history,
      getRecord,
      running,
      lastError,
      analyze,
      saveAnchor,
      clearHistory,
    }),
    [hydrated, activeWallet, setActiveWallet, records, history, getRecord, running, lastError, analyze, saveAnchor, clearHistory],
  );

  return <AnalysisContext.Provider value={value}>{children}</AnalysisContext.Provider>;
}

export function useAnalysis() {
  const ctx = useContext(AnalysisContext);
  if (!ctx) throw new Error("useAnalysis must be used inside <AnalysisProvider>");
  return ctx;
}

/**
 * The wallet a page should show: the one in the URL if present, otherwise the
 * active wallet from the store.
 */
export function useWalletParam(urlWallet: string | undefined) {
  const { activeWallet, setActiveWallet, hydrated } = useAnalysis();
  const fromUrl = urlWallet?.trim() || null;
  useEffect(() => {
    if (fromUrl && fromUrl.toLowerCase() !== activeWallet?.toLowerCase()) setActiveWallet(fromUrl);
  }, [fromUrl, activeWallet, setActiveWallet]);
  return { wallet: fromUrl ?? activeWallet, hydrated };
}
