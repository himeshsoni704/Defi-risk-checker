"use client";

import { useEffect, useId, useState } from "react";
import { isEthAddress, shortAddress } from "@/lib/format";
import { useSampleWallets } from "@/lib/queries";
import Icon from "@/components/ui/Icon";
import { WalletGlyph } from "@/components/ui/primitives";

/**
 * Command-bar style address input with validation, plus one-click sample
 * wallets from the dataset. Calls onSubmit with a valid 0x address.
 */
export default function WalletPicker({
  initial = "",
  submitLabel = "Analyze",
  busy,
  disabled,
  onSubmit,
  autoFocus,
  samples: sampleCount = 6,
  large,
}: {
  initial?: string;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (wallet: string) => void;
  autoFocus?: boolean;
  samples?: number;
  large?: boolean;
}) {
  const id = useId();
  const [value, setValue] = useState(initial);
  const [touched, setTouched] = useState(false);
  const samples = useSampleWallets(12);

  useEffect(() => setValue(initial), [initial]);

  const trimmed = value.trim();
  const valid = isEthAddress(trimmed);
  const showError = touched && trimmed.length > 0 && !valid;

  function submit(e: React.FormEvent) {
    e.preventDefault();
    setTouched(true);
    if (valid && !busy && !disabled) onSubmit(trimmed);
  }

  // Alternate safe / risky so both labels are one click away.
  const data = samples.data ?? [];
  const safe = data.filter((w) => w.label === 0);
  const risky = data.filter((w) => w.label === 1);
  const picks = Array.from({ length: sampleCount }, (_, i) => (i % 2 === 0 ? safe[i / 2] : risky[(i - 1) / 2])).filter(Boolean);

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 14 }} noValidate>
      <label className="sr-only" htmlFor={`${id}-addr`}>
        Wallet address
      </label>
      <div className="command-input" data-invalid={showError ? "true" : "false"} style={large ? { padding: "8px 8px 8px 18px" } : undefined}>
        <Icon name="wallet" className="lead" />
        <input
          id={`${id}-addr`}
          placeholder="0x… paste a wallet address"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onBlur={() => setTouched(true)}
          spellCheck={false}
          autoComplete="off"
          autoFocus={autoFocus}
          aria-invalid={showError}
          aria-describedby={`${id}-hint`}
          style={large ? { height: 44, fontSize: 15 } : undefined}
        />
        <button type="submit" className={`btn btn-primary${large ? " btn-lg" : ""}`} disabled={busy || disabled || (touched && !valid)}>
          {busy ? <span className="spinner" /> : <Icon name="arrowRight" />}
          {busy ? "Analyzing" : submitLabel}
        </button>
      </div>
      {showError ? (
        <div className="field-error" id={`${id}-hint`}>
          Enter a full address: 0x followed by 40 hexadecimal characters.
        </div>
      ) : (
        <div className="field-hint" id={`${id}-hint`}>
          Dataset addresses use their recorded features; unknown addresses get the backend&apos;s default profile.
        </div>
      )}

      {sampleCount > 0 && (
        <div className="stack" style={{ gap: 8 }}>
          <span className="faint small">Try a dataset wallet</span>
          <div className="row">
            {samples.loading &&
              Array.from({ length: sampleCount }).map((_, i) => <span key={i} className="skeleton" style={{ width: 128, height: 32, borderRadius: 999 }} />)}
            {samples.error ? <span className="faint small">Sample wallets unavailable while the API is unreachable.</span> : null}
            {picks.map((w) => (
              <button
                key={w.wallet_address}
                type="button"
                className="chip-btn"
                disabled={busy || disabled}
                onClick={() => {
                  setValue(w.wallet_address);
                  onSubmit(w.wallet_address);
                }}
                title={`Dataset label: ${w.label === 1 ? "risky" : "safe"}`}
              >
                <WalletGlyph address={w.wallet_address} size={20} />
                {shortAddress(w.wallet_address, 6, 4)}
                <span className="key-line" style={{ background: w.label === 1 ? "var(--up)" : "var(--down)", width: 8 }} />
              </button>
            ))}
          </div>
        </div>
      )}
    </form>
  );
}
