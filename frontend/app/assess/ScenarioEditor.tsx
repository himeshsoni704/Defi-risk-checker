"use client";

import { useEffect, useId, useState } from "react";
import { DEFAULT_PROFILE, FEATURES, type FeatureMeta } from "@/lib/features";
import type { WalletFeatures } from "@/lib/types";
import Icon from "@/components/ui/Icon";

// Bounds enforced by the API (api/models.py WalletFeatures).
function validate(meta: FeatureMeta, raw: string): string | null {
  if (raw.trim() === "") return "Required";
  const v = Number(raw);
  if (!Number.isFinite(v)) return "Not a number";
  if (v < 0) return "Must be ≥ 0";
  if (meta.format === "int" && !Number.isInteger(v)) return "Whole number";
  if (meta.format === "ratio" && v > 1) return "Between 0 and 1";
  if (meta.format === "score" && v > 100) return "Between 0 and 100";
  return null;
}

/** Lets the user score the wallet with their own feature values (POST /score with `features`). */
export default function ScenarioEditor({
  base,
  disabled,
  onRun,
}: {
  base: WalletFeatures | null;
  disabled?: boolean;
  onRun: (features: WalletFeatures) => void;
}) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const source = base ?? DEFAULT_PROFILE;
  const [values, setValues] = useState<Record<string, string>>(() => toStrings(source));

  useEffect(() => {
    if (!open) setValues(toStrings(base ?? DEFAULT_PROFILE));
  }, [base, open]);

  const errors = Object.fromEntries(FEATURES.map((f) => [f.key, validate(f, values[f.key] ?? "")]));
  const invalid = Object.values(errors).some(Boolean);

  function submit(e: React.FormEvent) {
    e.preventDefault();
    if (invalid || disabled) return;
    const features = Object.fromEntries(FEATURES.map((f) => [f.key, Number(values[f.key])])) as unknown as WalletFeatures;
    onRun(features);
  }

  return (
    <div className="stack" style={{ gap: 12 }}>
      <label className="switch">
        <input type="checkbox" checked={open} onChange={(e) => setOpen(e.target.checked)} id={`${id}-toggle`} />
        Scenario mode: set feature values yourself
      </label>
      {open && (
        <form onSubmit={submit} className="stack rise" style={{ gap: 12 }} noValidate>
          <p className="faint" style={{ fontSize: 12.5 }}>
            Prefilled from {base ? "the current result" : "the backend's default profile"}. Scoring a scenario replaces this wallet&apos;s stored decision on the
            server, so the explanation, audit and proof pages will reflect it.
          </p>
          <div className="grid g-2" style={{ gap: 10 }}>
            {FEATURES.map((f) => {
              const err = errors[f.key];
              return (
                <div className="field" key={f.key}>
                  <label className="field-label" htmlFor={`${id}-${f.key}`} style={{ fontSize: 12 }}>
                    {f.label}
                    {f.quantum && <span style={{ color: "var(--iris-2)" }}> · circuit</span>}
                  </label>
                  {f.format === "flag" ? (
                    <select
                      id={`${id}-${f.key}`}
                      className="input input-sm"
                      value={values[f.key]}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    >
                      <option value="0">No</option>
                      <option value="1">Yes</option>
                    </select>
                  ) : (
                    <input
                      id={`${id}-${f.key}`}
                      className="input input-sm mono"
                      inputMode="decimal"
                      value={values[f.key]}
                      aria-invalid={Boolean(err)}
                      onChange={(e) => setValues((p) => ({ ...p, [f.key]: e.target.value }))}
                    />
                  )}
                  {err && <span className="field-error">{err}</span>}
                </div>
              );
            })}
          </div>
          <div className="row">
            <button type="submit" className="btn btn-primary btn-sm" disabled={invalid || disabled}>
              <Icon name="play" /> Score scenario
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setValues(toStrings(base ?? DEFAULT_PROFILE))}>
              Reset values
            </button>
          </div>
        </form>
      )}
    </div>
  );
}

function toStrings(f: WalletFeatures): Record<string, string> {
  return Object.fromEntries(
    FEATURES.map((m) => {
      const v = Number(f[m.key]);
      return [m.key, m.format === "int" || m.format === "flag" ? String(Math.round(v)) : String(v)];
    }),
  );
}
