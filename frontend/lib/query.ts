"use client";

// A small keyed request cache shared by every page. It dedupes concurrent
// requests, keeps results across client-side navigation, and lets the
// analysis store invalidate a wallet's data after a new score is produced.

import { useCallback, useEffect, useRef, useState } from "react";

interface Entry<T = unknown> {
  data?: T;
  error?: unknown;
  promise?: Promise<T>;
  updatedAt?: number;
}

const cache = new Map<string, Entry>();
const listeners = new Map<string, Set<() => void>>();

function notify(key: string) {
  listeners.get(key)?.forEach((fn) => fn());
}

function subscribe(key: string, fn: () => void) {
  let set = listeners.get(key);
  if (!set) {
    set = new Set();
    listeners.set(key, set);
  }
  set.add(fn);
  return () => {
    set!.delete(fn);
  };
}

export function fetchQuery<T>(key: string, fetcher: () => Promise<T>): Promise<T> {
  const existing = cache.get(key) as Entry<T> | undefined;
  if (existing?.promise) return existing.promise;
  const promise = fetcher()
    .then((data) => {
      cache.set(key, { data, updatedAt: Date.now() });
      notify(key);
      return data;
    })
    .catch((error) => {
      cache.set(key, { data: existing?.data, error, updatedAt: existing?.updatedAt });
      notify(key);
      throw error;
    });
  cache.set(key, { ...existing, promise });
  notify(key);
  return promise;
}

export function hasQueryData(key: string): boolean {
  return cache.get(key)?.data !== undefined;
}

export function setQueryData<T>(key: string, data: T) {
  cache.set(key, { data, updatedAt: Date.now() });
  notify(key);
}

export function invalidateQueries(match: (key: string) => boolean) {
  for (const key of Array.from(cache.keys())) {
    if (match(key)) {
      cache.delete(key);
      notify(key);
    }
  }
}

export interface QueryState<T> {
  data: T | undefined;
  error: unknown;
  loading: boolean;
  /** True while a request is in flight, including background refreshes. */
  fetching: boolean;
  updatedAt: number | undefined;
  refetch: () => Promise<T | undefined>;
}

export function useQuery<T>(
  key: string | null,
  fetcher: () => Promise<T>,
  options: { refreshInterval?: number } = {},
): QueryState<T> {
  const fetcherRef = useRef(fetcher);
  fetcherRef.current = fetcher;
  const [, force] = useState(0);

  useEffect(() => {
    if (!key) return;
    const unsub = subscribe(key, () => {
      // Invalidated while mounted: fetch fresh data instead of sitting empty.
      if (!cache.has(key)) fetchQuery(key, () => fetcherRef.current()).catch(() => {});
      force((n) => n + 1);
    });
    const entry = cache.get(key);
    if (!entry || (!entry.data && !entry.promise && !entry.error)) {
      fetchQuery(key, () => fetcherRef.current()).catch(() => {});
    }
    return unsub;
  }, [key]);

  useEffect(() => {
    if (!key || !options.refreshInterval) return;
    const id = setInterval(() => {
      fetchQuery(key, () => fetcherRef.current()).catch(() => {});
    }, options.refreshInterval);
    return () => clearInterval(id);
  }, [key, options.refreshInterval]);

  const refetch = useCallback(async () => {
    if (!key) return undefined;
    const current = cache.get(key);
    if (current?.error) cache.set(key, { data: current.data, updatedAt: current.updatedAt });
    try {
      return await fetchQuery(key, () => fetcherRef.current());
    } catch {
      return undefined;
    }
  }, [key]);

  const entry = (key ? cache.get(key) : undefined) as Entry<T> | undefined;
  const fetching = Boolean(entry?.promise);
  return {
    data: entry?.data,
    error: entry?.promise ? undefined : entry?.error,
    loading: Boolean(key) && entry?.data === undefined && (fetching || !entry),
    fetching,
    updatedAt: entry?.updatedAt,
    refetch,
  };
}
