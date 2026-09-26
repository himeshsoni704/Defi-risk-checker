"use client";

import { useState } from "react";
import { verifyWalletOnChain, getVerification, type VerifyResponse, type VerifyPostResponse } from "@/lib/api";

interface VerifyPanelProps {
  walletAddress: string;
  decisionHash: string;
}

export default function VerifyPanel({ walletAddress, decisionHash }: VerifyPanelProps) {
  const [status, setStatus] = useState<"idle" | "verifying" | "verified" | "failed">("idle");
  const [verification, setVerification] = useState<VerifyResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const handleVerify = async () => {
    setStatus("verifying");
    setError(null);

    try {
      // First, anchor the hash on-chain
      const postResult: VerifyPostResponse = await verifyWalletOnChain(walletAddress);

      // Then verify it
      const verifyResult: VerifyResponse = await getVerification(walletAddress);

      setVerification(verifyResult);
      setStatus(verifyResult.verified ? "verified" : "failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Verification failed");
      setStatus("failed");
    }
  };

  const handleCheckStatus = async () => {
    setStatus("verifying");
    setError(null);

    try {
      const verifyResult: VerifyResponse = await getVerification(walletAddress);
      setVerification(verifyResult);
      setStatus(verifyResult.verified ? "verified" : "failed");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Status check failed");
      setStatus("failed");
    }
  };

  return (
    <div className="verify-panel">
      <h3 style={{ marginBottom: 16 }}>On-Chain Proof</h3>

      <div className="hash-display">
        <div className="hash-label">Decision Hash (Keccak256)</div>
        <div className="hash-value mono">{decisionHash}</div>
      </div>

      <div className="verify-actions">
        {status === "idle" && (
          <button
            className="btn btn-primary"
            onClick={handleVerify}
            disabled={status === "verifying"}
          >
            Verify on chain
          </button>
        )}

        {status === "verifying" && (
          <button className="btn btn-primary" disabled>
            <span className="spinner" />
            Processing...
          </button>
        )}

        {status === "verified" && verification && (
          <div className="verification-result verified">
            <div className="verification-icon">✓</div>
            <div className="verification-text">Verified on-chain</div>
            <a
              href={verification.explorer_url}
              target="_blank"
              rel="noopener noreferrer"
              className="explorer-link"
            >
              View transaction →
            </a>
          </div>
        )}

        {status === "failed" && (
          <div className="verification-result failed">
            <div className="verification-icon">✗</div>
            <div className="verification-text">
              {error || "Verification failed"}
            </div>
            <button
              className="btn btn-ghost"
              onClick={handleCheckStatus}
              style={{ marginTop: 12 }}
            >
              Check status
            </button>
          </div>
        )}
      </div>

      {verification && status === "verified" && (
        <div className="verification-details">
          <div className="detail-row">
            <span className="detail-label">Network:</span>
            <span className="detail-value">{verification.network}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Transaction:</span>
            <span className="detail-value mono">{verification.tx_hash.slice(0, 10)}…{verification.tx_hash.slice(-8)}</span>
          </div>
          <div className="detail-row">
            <span className="detail-label">Timestamp:</span>
            <span className="detail-value">
              {new Date(verification.timestamp * 1000).toLocaleString()}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}