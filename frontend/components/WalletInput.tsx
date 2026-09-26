"use client";

import { useState, useEffect } from "react";
import { getWallets, type SampleWallet } from "@/lib/api";

interface WalletInputProps {
  onSubmit: (wallet: string) => void;
  disabled?: boolean;
}

export default function WalletInput({ onSubmit, disabled = false }: WalletInputProps) {
  const [wallets, setWallets] = useState<SampleWallet[]>([]);
  const [selectedWallet, setSelectedWallet] = useState("");
  const [customWallet, setCustomWallet] = useState("");
  const [useCustom, setUseCustom] = useState(false);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getWallets(12)
      .then((w) => setWallets(w))
      .catch(() => {
        // Sample wallets are optional
      });
  }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const wallet = useCustom ? customWallet.trim() : selectedWallet;
    if (wallet) {
      onSubmit(wallet);
    }
  };

  return (
    <div className="panel">
      <form onSubmit={handleSubmit}>
        <div className="row">
          <select
            value={selectedWallet}
            onChange={(e) => {
              setSelectedWallet(e.target.value);
              setUseCustom(false);
            }}
            disabled={disabled || useCustom}
            aria-label="Sample wallets"
          >
            <option value="">Select a sample wallet…</option>
            {wallets.map((w) => (
              <option key={w.wallet_address} value={w.wallet_address}>
                {w.label === 1 ? "⚠ risky" : "✓ safe"} - {w.wallet_address.slice(0, 10)}…{w.wallet_address.slice(-6)}
              </option>
            ))}
          </select>
        </div>

        <div className="row" style={{ marginTop: 12 }}>
          <input
            type="text"
            placeholder="0x… wallet address"
            value={customWallet}
            onChange={(e) => {
              setCustomWallet(e.target.value);
              if (e.target.value) {
                setUseCustom(true);
              }
            }}
            disabled={disabled}
          />
          <button className="btn btn-primary" disabled={disabled || (!selectedWallet && !customWallet)}>
            {loading ? <span className="spinner" /> : null}
            {loading ? "Loading…" : "Score wallet"}
          </button>
        </div>

        <div style={{ marginTop: 16 }}>
          <label
            style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 14 }}
          >
            <input
              type="checkbox"
              checked={useCustom}
              onChange={(e) => setUseCustom(e.target.checked)}
              disabled={disabled}
            />
            Use custom address instead of sample
          </label>
        </div>

        <div className="hint">
          {useCustom
            ? "Enter any wallet address to score it with default features."
            : "Select a sample wallet from the dataset or enter a custom address."}
        </div>
      </form>
    </div>
  );
}