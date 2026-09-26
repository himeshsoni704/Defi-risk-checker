// Single HTTP client for the DeFi Risk Checker API. Every network call in the
// app goes through here so error handling and the base URL live in one place.

import type {
  AnchorResponse,
  AuditReport,
  ExplainResponse,
  HealthResponse,
  ModelComparison,
  SampleWallet,
  ScoreResponse,
  VerifyResponse,
  WalletFeatures,
} from "./types";

export const API_BASE = (
  process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000"
).replace(/\/+$/, "");

export type ApiErrorKind = "network" | "timeout" | "http" | "parse";

export class ApiError extends Error {
  readonly kind: ApiErrorKind;
  readonly status: number | null;
  readonly path: string;

  constructor(kind: ApiErrorKind, message: string, path: string, status: number | null = null) {
    super(message);
    this.name = "ApiError";
    this.kind = kind;
    this.status = status;
    this.path = path;
  }
}

async function request<T>(
  path: string,
  init: RequestInit = {},
  timeoutMs = 90_000,
): Promise<T> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  let res: Response;
  try {
    res = await fetch(`${API_BASE}${path}`, {
      ...init,
      headers: { "Content-Type": "application/json", ...(init.headers ?? {}) },
      signal: controller.signal,
    });
  } catch (err) {
    clearTimeout(timer);
    if (controller.signal.aborted) {
      throw new ApiError("timeout", `The API did not respond within ${timeoutMs / 1000}s.`, path);
    }
    throw new ApiError(
      "network",
      `Could not reach the API at ${API_BASE}. Start the backend with "uvicorn api.main:app --port 8000" or set NEXT_PUBLIC_API_BASE.`,
      path,
    );
  }
  clearTimeout(timer);

  const text = await res.text();
  let body: unknown = null;
  if (text) {
    try {
      body = JSON.parse(text);
    } catch {
      if (res.ok) throw new ApiError("parse", "The API returned a response that is not JSON.", path, res.status);
    }
  }

  if (!res.ok) {
    const detail =
      body && typeof body === "object" && "detail" in body
        ? formatDetail((body as { detail: unknown }).detail)
        : text || res.statusText;
    throw new ApiError("http", detail || `Request failed with status ${res.status}.`, path, res.status);
  }
  return body as T;
}

function formatDetail(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    // FastAPI validation errors: [{loc: [...], msg: "..."}]
    return detail
      .map((d) => {
        if (d && typeof d === "object" && "msg" in d) {
          const loc = Array.isArray((d as { loc?: unknown[] }).loc)
            ? (d as { loc: unknown[] }).loc.filter((p) => p !== "body").join(".")
            : "";
          return loc ? `${loc}: ${(d as { msg: string }).msg}` : (d as { msg: string }).msg;
        }
        return String(d);
      })
      .join("; ");
  }
  return JSON.stringify(detail);
}

const enc = (wallet: string) => encodeURIComponent(wallet.trim());

export const api = {
  /** Returns the health payload plus the round-trip time measured by the browser. */
  async health(): Promise<HealthResponse & { latencyMs: number }> {
    const t0 = performance.now();
    const data = await request<HealthResponse>("/health", {}, 10_000);
    return { ...data, latencyMs: Math.round(performance.now() - t0) };
  },

  wallets(limit = 12): Promise<SampleWallet[]> {
    return request<SampleWallet[]>(`/wallets?limit=${limit}`, {}, 15_000);
  },

  score(walletAddress: string, features?: Partial<WalletFeatures>): Promise<ScoreResponse> {
    return request<ScoreResponse>("/score", {
      method: "POST",
      body: JSON.stringify({
        wallet_address: walletAddress.trim(),
        ...(features ? { features } : {}),
      }),
    });
  },

  explain(wallet: string): Promise<ExplainResponse> {
    return request<ExplainResponse>(`/explain/${enc(wallet)}`);
  },

  explainWithLLM(wallet: string): Promise<ExplainResponse> {
    return request<ExplainResponse>(`/explain/llm/${enc(wallet)}`, {}, 120_000);
  },

  audit(wallet: string): Promise<AuditReport> {
    return request<AuditReport>(`/audit/${enc(wallet)}`);
  },

  compare(): Promise<ModelComparison> {
    return request<ModelComparison>("/compare", {}, 15_000);
  },

  /** Anchors the stored decision hash on-chain (POST /verify/{wallet}). */
  anchor(wallet: string): Promise<AnchorResponse> {
    return request<AnchorResponse>(`/verify/${enc(wallet)}`, { method: "POST" }, 120_000);
  },

  /** Reads the on-chain hash and compares it with the stored record (GET /verify/{wallet}). */
  verify(wallet: string): Promise<VerifyResponse> {
    return request<VerifyResponse>(`/verify/${enc(wallet)}`, {}, 60_000);
  },
};

export function errorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  return String(err);
}
