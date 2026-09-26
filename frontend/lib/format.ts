export function isEthAddress(value: string): boolean {
  return /^0x[0-9a-fA-F]{40}$/.test(value.trim());
}

export function shortAddress(address: string, head = 6, tail = 4): string {
  const a = address.trim();
  if (a.length <= head + tail + 1) return a;
  return `${a.slice(0, head)}…${a.slice(-tail)}`;
}

export function shortHash(hash: string, head = 10, tail = 8): string {
  return shortAddress(hash, head, tail);
}

export function fmtNumber(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("en-US", { minimumFractionDigits: digits, maximumFractionDigits: digits });
}

export function fmtSigned(value: number, digits = 1): string {
  const s = Math.abs(value).toFixed(digits);
  if (Number(s) === 0) return (0).toFixed(digits);
  return `${value > 0 ? "+" : "−"}${s}`;
}

export function fmtPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return `${(value * 100).toFixed(digits)}%`;
}

export function fmtDateTime(unixSeconds: number | string | null | undefined): string {
  if (unixSeconds === null || unixSeconds === undefined || unixSeconds === "") return "—";
  const n = typeof unixSeconds === "string" ? Number(unixSeconds) : unixSeconds;
  if (!Number.isFinite(n)) return String(unixSeconds);
  return new Date(n * 1000).toLocaleString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export function fmtRelative(unixMs: number, now = Date.now()): string {
  const diff = Math.max(0, now - unixMs);
  const s = Math.round(diff / 1000);
  if (s < 45) return "just now";
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 24) return `${h} h ago`;
  const d = Math.round(h / 24);
  return `${d} d ago`;
}

export function fmtDuration(ms: number): string {
  if (ms < 1000) return `${Math.round(ms)} ms`;
  return `${(ms / 1000).toFixed(1)} s`;
}
