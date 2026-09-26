"use client";

// Named queries so every page shares one cache key per resource.

import { api } from "./api";
import { useQuery } from "./query";
import { walletKey } from "./analysis-store";

export const useHealth = () => useQuery("health", api.health, { refreshInterval: 30_000 });

export const useSampleWallets = (limit = 12) => useQuery(`wallets:${limit}`, () => api.wallets(limit));

export const useComparison = () => useQuery("compare", api.compare);

export const useExplanation = (wallet: string | null) =>
  useQuery(wallet ? `explain:${walletKey(wallet)}` : null, () => api.explain(wallet!));

export const useAudit = (wallet: string | null) =>
  useQuery(wallet ? `audit:${walletKey(wallet)}` : null, () => api.audit(wallet!));

export const useVerification = (wallet: string | null) =>
  useQuery(wallet ? `verify:${walletKey(wallet)}` : null, () => api.verify(wallet!));
