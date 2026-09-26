"use client";

import { useEffect, useId, useState } from "react";
import { isEthAddress, shortAddress } from "@/lib/format";
import { useSampleWallets } from "@/lib/queries";
import Icon from "@/components/ui/Icon";

/**
 * Address input with validation plus a picker for the dataset's sample
 * wallets. Calls onSubmit with a valid 0x address.
 */
export default function WalletPicker({
  initial = "",
  submitLabel = "Analyze",
  busy,
  disabled,
  onSubmit,
  autoFocus,
}: {
  initial?: string;
  submitLabel?: string;
  busy?: boolean;
  disabled?: boolean;
  onSubmit: (wallet: string) => void;
  autoFocus?: boolean;
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

  return (
    <form onSubmit={submit} className="stack" style={{ gap: 12 }} noValidate>
      <div className="field">
        <label className="field-label" htmlFor={`${id}-addr`}>
          Wallet address
        </label>
        <div className="input-group">
          <input
            id={`${id}-addr`}
            className="input mono"
            placeholder="0x…  (40 hex characters)"
            value={value}
            onChange={(e) => setValue(e.target.value)}
            onBlur={() => setTouched(true)}
            spellCheck={false}
            autoComplete="off"
            autoFocus={autoFocus}
            aria-invalid={showError}
            aria-describedby={`${id}-hint`}
          />
          <button type="submit" className="btn btn-primary" disabled={busy || disabled || (touched && !valid)}>
            {busy ? <span className="spinner" /> : <Icon name="play" />}
            {busy ? "Analyzing…" : submitLabel}
          </button>
        </div>
        {showError ? (
          <div className="field-error" id={`${id}-hint`}>
            Enter a full address: 0x followed by 40 hexadecimal characters.
          </div>
        ) : (
          <div className="field-hint" id={`${id}-hint`}>
            Addresses in the dataset use their recorded features. Unknown addresses are scored with the backend&apos;s default profile.
          </div>
        )}
      </div>

      <div className="field">
        <label className="field-label" htmlFor={`${id}-sample`}>
          Or pick a sample wallet
        </label>
        <select
          id={`${id}-sample`}
          className="input input-sm"
          value=""
          disabled={samples.loading || Boolean(samples.error) || !samples.data?.length}
          onChange={(e) => {
            if (e.target.value) {
              setValue(e.target.value);
              setTouched(true);
            }
          }}
        >
          <option value="">
            {samples.loading
              ? "Loading sample wallets…"
              : samples.error
                ? "Sample wallets unavailable (API unreachable)"
                : samples.data?.length
                  ? `${samples.data.length} wallets from the dataset`
                  : "Dataset is empty"}
          </option>
          {samples.data?.map((w) => (
            <option key={w.wallet_address} value={w.wallet_address}>
              {shortAddress(w.wallet_address, 10, 6)} — labeled {w.label === 1 ? "risky" : "safe"}, repayment {(w.repayment_ratio * 100).toFixed(0)}%
            </option>
          ))}
        </select>
      </div>
    </form>
  );
}
