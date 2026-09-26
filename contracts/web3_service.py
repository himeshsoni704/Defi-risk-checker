"""
Web3 Service for On-Chain Proof-of-Decision.
Implements the Off-Chain Compute → On-Chain Write Oracle pattern:

  1. Builds a canonicalized JSON record containing:
       wallet_id, model provenance, risk_score, decision, features,
       explanation, and XAI audit results.
  2. Computes Keccak256(canonical_record_json).
  3. Submits the hash on-chain via smart contract recordDecision().
  4. Queries on-chain state to verify proofs against stored records.

This means the blockchain commitment proves:
  "This exact prediction, explanation, model version, and audit result
   were the record associated with this decision."
Not just "the wallet was denied."

Dual mode: Live Sepolia testnet or zero-config local simulated provider.
"""

import os
import json
import time
from typing import Dict, Any, Optional
from web3 import Web3
from eth_account import Account
from dotenv import load_dotenv

load_dotenv()

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
ARTIFACT_PATH = os.path.join(BASE_DIR, "artifacts", "DecisionProof.json")
LOCAL_LEDGER_PATH = os.path.join(os.path.dirname(BASE_DIR), "data", "local_ledger.json")


def build_canonical_record(
    wallet_id: str,
    model_version_record: dict,
    risk_score: float,
    decision: str,
    features: dict,
    explanation: dict,
    audit: dict,
    timestamp: int,
) -> dict:
    """
    Build the canonicalized record that gets hashed and committed to the blockchain.

    Including audit results means the blockchain proves not just the score
    but also that the explanation was independently tested and what that test found.

    Returns:
        A deterministic dict (will be JSON-serialized with sorted keys for hashing).
    """
    return {
        "wallet_id": wallet_id.lower(),
        "model": {
            "model_id": model_version_record.get("model_id", "QSVC-ZZFeatureMap"),
            "model_version": model_version_record.get("model_version", "2.0"),
            "dataset_version": model_version_record.get("dataset_version", "2.0"),
            "feature_schema_version": model_version_record.get("feature_schema_version", "2.0"),
            "qml_features": model_version_record.get("qml_features", []),
            "n_qubits": model_version_record.get("n_qubits", 6),
            "trained_at": model_version_record.get("trained_at", "unknown"),
        },
        "risk_score": round(float(risk_score), 1),
        "decision": decision.upper(),
        "features": {k: round(float(v), 4) if isinstance(v, float) else v
                     for k, v in sorted(features.items())},
        "explanation": {
            "base_value": explanation.get("base_risk_value", 0.0),
            "feature_contributions": {
                k: round(float(v), 2)
                for k, v in sorted(
                    explanation.get("feature_contributions", {}).items()
                )
            },
        },
        "audit": {
            "faithfulness": round(float(audit.get("faithfulness", {}).get("score", 0)), 3),
            "faithfulness_verdict": audit.get("faithfulness", {}).get("verdict", "UNKNOWN"),
            "stability": round(float(audit.get("stability", {}).get("score", 0)), 3),
            "stability_verdict": audit.get("stability", {}).get("verdict", "UNKNOWN"),
            "sensitivity": round(float(audit.get("sensitivity", {}).get("score", 0)), 3),
            "sensitivity_verdict": audit.get("sensitivity", {}).get("verdict", "UNKNOWN"),
            "overall_verdict": audit.get("overall_verdict", "UNKNOWN"),
        },
        "timestamp": timestamp,
        "schema_version": "2.0",
    }


def compute_canonical_hash(canonical_record: dict) -> str:
    """
    Compute Keccak256 of the canonical record JSON (sorted keys, no extra whitespace).
    Returns '0x' + hex string.
    """
    canonical_json = json.dumps(canonical_record, sort_keys=True, separators=(",", ":"))
    hash_bytes = Web3.keccak(text=canonical_json)
    return "0x" + hash_bytes.hex().lower().replace("0x", "")


def compute_decision_hash(
    wallet_address: str,
    risk_score: float,
    explanation: dict,
    model_version_record: dict = None,
    features: dict = None,
    audit: dict = None,
) -> str:
    """
    Public helper — computes the canonical Keccak256 hash for a decision.

    If model_version_record, features and audit are provided, hashes the full
    canonical record (v2.0 schema).  Falls back gracefully to the v1.0 simple
    payload for backwards compatibility.
    """
    timestamp = int(time.time())

    if model_version_record and features is not None and audit is not None:
        record = build_canonical_record(
            wallet_id=wallet_address,
            model_version_record=model_version_record,
            risk_score=risk_score,
            decision="DENY" if risk_score >= 50.0 else "APPROVE",
            features=features,
            explanation=explanation,
            audit=audit,
            timestamp=timestamp,
        )
        return compute_canonical_hash(record)

    # ── v1.0 fallback ──────────────────────────────────────────────────
    checksum = (
        Web3.to_checksum_address(wallet_address)
        if wallet_address.startswith("0x") and len(wallet_address) == 42
        else wallet_address.lower()
    )
    contributions = explanation.get("feature_contributions", explanation)
    canonical_json = json.dumps(contributions, sort_keys=True, separators=(",", ":"))
    payload = f"{checksum.lower()}:{float(risk_score):.1f}:{canonical_json}"
    return "0x" + Web3.keccak(text=payload).hex().lower().replace("0x", "")


class Web3Service:
    def __init__(self):
        self.rpc_url = os.getenv("SEPOLIA_RPC_URL", "").strip()
        self.private_key = os.getenv("PRIVATE_KEY", "").strip()
        self.contract_address = os.getenv("CONTRACT_ADDRESS", "").strip()
        self.explorer_base_url = os.getenv("EXPLORER_BASE_URL", "https://sepolia.etherscan.io").rstrip("/")

        self.w3: Optional[Web3] = None
        self.account = None
        self.contract = None
        self.is_live_sepolia = False

        self._init_provider()

    def _init_provider(self):
        if os.path.exists(ARTIFACT_PATH):
            with open(ARTIFACT_PATH, "r") as f:
                self.artifact = json.load(f)
        else:
            self.artifact = {"abi": []}

        if self.rpc_url and self.private_key and self.contract_address:
            try:
                w3_instance = Web3(Web3.HTTPProvider(self.rpc_url))
                if w3_instance.is_connected():
                    self.w3 = w3_instance
                    self.account = self.w3.eth.account.from_key(self.private_key)
                    self.contract = self.w3.eth.contract(
                        address=Web3.to_checksum_address(self.contract_address),
                        abi=self.artifact["abi"]
                    )
                    self.is_live_sepolia = True
                    print(f"[Web3Service] Connected to LIVE Sepolia at {self.contract_address}")
                    return
            except Exception as e:
                print(f"[Web3Service] Could not connect to Sepolia ({e}). Falling back to local provider.")

        print("[Web3Service] Operating in High-Fidelity Local Simulated Blockchain Provider mode.")
        self.is_live_sepolia = False

    def _load_local_ledger(self) -> Dict[str, Any]:
        if os.path.exists(LOCAL_LEDGER_PATH):
            try:
                with open(LOCAL_LEDGER_PATH, "r") as f:
                    return json.load(f)
            except Exception:
                pass
        return {}

    def _save_local_ledger(self, ledger: Dict[str, Any]):
        os.makedirs(os.path.dirname(LOCAL_LEDGER_PATH), exist_ok=True)
        with open(LOCAL_LEDGER_PATH, "w") as f:
            json.dump(ledger, f, indent=2)

    def record_decision_on_chain(
        self,
        wallet_address: str,
        decision_hash: str,
        canonical_record: dict = None,
    ) -> Dict[str, Any]:
        """
        Submits the canonical decision hash on-chain.
        The canonical_record is stored in the local ledger for local-mode
        reconstruction / audit verification.
        """
        checksum_addr = (
            Web3.to_checksum_address(wallet_address)
            if wallet_address.startswith("0x") and len(wallet_address) == 42
            else wallet_address
        )

        if self.is_live_sepolia:
            try:
                hash_bytes32 = bytes.fromhex(decision_hash.replace("0x", ""))
                nonce = self.w3.eth.get_transaction_count(self.account.address)

                tx = self.contract.functions.recordDecisionForWallet(
                    checksum_addr,
                    hash_bytes32
                ).build_transaction({
                    "from": self.account.address,
                    "nonce": nonce,
                    "gasPrice": int(self.w3.eth.gas_price * 1.2),
                    "chainId": self.w3.eth.chain_id,
                })

                signed_tx = self.w3.eth.account.sign_transaction(tx, private_key=self.private_key)
                tx_hash_bytes = self.w3.eth.send_raw_transaction(signed_tx.raw_transaction)
                tx_hash = "0x" + tx_hash_bytes.hex().replace("0x", "")

                receipt = self.w3.eth.wait_for_transaction_receipt(tx_hash_bytes, timeout=90)
                block = self.w3.eth.get_block(receipt.blockNumber)
                timestamp = block.timestamp

                return {
                    "network": "Sepolia Testnet",
                    "status": "confirmed" if receipt.status == 1 else "failed",
                    "tx_hash": tx_hash,
                    "block_number": receipt.blockNumber,
                    "wallet_address": checksum_addr,
                    "decision_hash": decision_hash,
                    "timestamp": timestamp,
                    "explorer_url": f"{self.explorer_base_url}/tx/{tx_hash}",
                    "schema_version": "2.0",
                }
            except Exception as e:
                print(f"[Web3Service] Sepolia on-chain error: {e}. Falling back to simulated.")

        # ── Local Simulated Provider ──────────────────────────────────
        ledger = self._load_local_ledger()
        timestamp = int(time.time())
        seed = f"tx:{checksum_addr}:{decision_hash}:{timestamp}"
        sim_tx_hash = "0x" + Web3.keccak(text=seed).hex().replace("0x", "")
        sim_block = 6_540_000 + len(ledger) + 1

        record = {
            "wallet_address": checksum_addr,
            "decision_hash": decision_hash,
            "timestamp": timestamp,
            "tx_hash": sim_tx_hash,
            "block_number": sim_block,
            "network": "Sepolia Testnet (Simulated Provider)",
            "schema_version": "2.0",
        }
        if canonical_record:
            record["canonical_record"] = canonical_record

        ledger[checksum_addr.lower()] = record
        self._save_local_ledger(ledger)

        return {
            "network": "Sepolia Testnet (Simulated Provider)",
            "status": "confirmed",
            "tx_hash": sim_tx_hash,
            "block_number": sim_block,
            "wallet_address": checksum_addr,
            "decision_hash": decision_hash,
            "timestamp": timestamp,
            "explorer_url": f"{self.explorer_base_url}/tx/{sim_tx_hash}",
            "schema_version": "2.0",
        }

    def verify_decision_on_chain(
        self,
        wallet_address: str,
        expected_hash: Optional[str] = None,
    ) -> Dict[str, Any]:
        """
        Read on-chain decision hash and verify it matches the expected_hash.
        Also reconstructs and returns the full canonical_record for audit inspection.
        """
        checksum_addr = (
            Web3.to_checksum_address(wallet_address)
            if wallet_address.startswith("0x") and len(wallet_address) == 42
            else wallet_address
        )

        if self.is_live_sepolia:
            try:
                on_chain_hash_raw, on_chain_timestamp = self.contract.functions.getDecision(checksum_addr).call()
                on_chain_hash = "0x" + on_chain_hash_raw.hex().replace("0x", "")
                is_zero = on_chain_hash == "0x" + "00" * 32
                verified = (not is_zero) and (
                    on_chain_hash.lower() == expected_hash.lower() if expected_hash else True
                )
                return {
                    "network": "Sepolia Testnet",
                    "wallet_address": checksum_addr,
                    "verified": verified,
                    "on_chain_hash": on_chain_hash if not is_zero else None,
                    "expected_hash": expected_hash,
                    "timestamp": on_chain_timestamp if not is_zero else None,
                    "contract_address": self.contract_address,
                    "explorer_url": f"{self.explorer_base_url}/address/{self.contract_address}",
                    "schema_version": "2.0",
                }
            except Exception as e:
                print(f"[Web3Service] Error querying Sepolia ({e}). Falling back to local ledger.")

        ledger = self._load_local_ledger()
        record = ledger.get(checksum_addr.lower())

        if not record:
            return {
                "network": "Sepolia Testnet (Simulated Provider)",
                "wallet_address": checksum_addr,
                "verified": False,
                "on_chain_hash": None,
                "expected_hash": expected_hash,
                "timestamp": None,
                "explorer_url": None,
                "message": "No decision hash anchored on-chain for this wallet yet.",
            }

        on_chain_hash = record["decision_hash"]
        verified = True
        if expected_hash:
            verified = (on_chain_hash.lower() == expected_hash.lower())

        return {
            "network": record.get("network", "Sepolia Testnet (Simulated Provider)"),
            "wallet_address": checksum_addr,
            "verified": verified,
            "on_chain_hash": on_chain_hash,
            "expected_hash": expected_hash,
            "timestamp": record.get("timestamp"),
            "tx_hash": record.get("tx_hash"),
            "explorer_url": f"{self.explorer_base_url}/tx/{record.get('tx_hash')}",
            "canonical_record": record.get("canonical_record"),
            "schema_version": record.get("schema_version", "1.0"),
        }


# Global singleton
web3_service = Web3Service()
