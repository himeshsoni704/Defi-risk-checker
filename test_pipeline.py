"""
Comprehensive End-to-End Pipeline Verification Suite for DeFi Risk Checker.
Tests all endpoints:
  - GET /health
  - GET /wallets
  - POST /score (custom features & dataset lookup)
  - GET /explain/{wallet_id}
  - POST /verify/{wallet_id} (on-chain write)
  - GET /verify/{wallet_id} (on-chain proof verification)
"""

import sys
import os
from fastapi.testclient import TestClient

# Ensure root is in path
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
if BASE_DIR not in sys.path:
    sys.path.insert(0, BASE_DIR)

from api.main import app

client = TestClient(app)


def run_all_tests():
    print("==================================================")
    print(" Running DeFi Risk Checker E2E Verification Suite ")
    print("==================================================")

    # 1. Test Health Check
    print("\n[1] Testing GET /health...")
    res = client.get("/health")
    assert res.status_code == 200, f"Health check failed: {res.text}"
    health = res.json()
    print("  -> Status:", health["status"])
    print("  -> Quantum Model:", health["quantum_model"]["type"])
    print("  -> Web3 Network:", health["web3"]["network"])

    # 2. Test Sample Wallets
    print("\n[2] Testing GET /wallets...")
    res = client.get("/wallets?limit=4")
    assert res.status_code == 200, f"Get wallets failed: {res.text}"
    wallets = res.json()
    assert len(wallets) == 4, f"Expected 4 sample wallets, got {len(wallets)}"
    sample_wallet_addr = wallets[0]["wallet_address"]
    print(f"  -> Retrieved {len(wallets)} sample wallets. Picked test wallet: {sample_wallet_addr}")

    # 3. Test POST /score with explicit features
    print("\n[3] Testing POST /score (Explicit Features)...")
    custom_addr = "0x999999cf1046e68e36E1aA2E0E07105eDDD1f08E"
    score_payload = {
        "wallet_address": custom_addr,
        "features": {
            "repayment_history_score": 88.0,
            "high_risk_tx_count": 0,
            "wallet_age_days": 850,
            "balance_stability_score": 92.0
        }
    }
    res = client.post("/score", json=score_payload)
    assert res.status_code == 200, f"Score post failed: {res.text}"
    score_data = res.json()
    print("  -> Risk Score:", score_data["risk_score"])
    print("  -> Decision:", score_data["decision"])
    print("  -> Decision Hash:", score_data["decision_hash"])
    assert score_data["decision"] in ["approve", "deny"]
    assert score_data["decision_hash"].startswith("0x")

    # 4. Test POST /score with dataset lookup
    print("\n[4] Testing POST /score (Dataset Address Lookup)...")
    lookup_payload = {"wallet_address": sample_wallet_addr}
    res = client.post("/score", json=lookup_payload)
    assert res.status_code == 200, f"Score lookup failed: {res.text}"
    lookup_score = res.json()
    print("  -> Looked up wallet risk score:", lookup_score["risk_score"])
    print("  -> Looked up decision:", lookup_score["decision"])

    # 5. Test GET /explain/{wallet_id}
    print(f"\n[5] Testing GET /explain/{custom_addr}...")
    res = client.get(f"/explain/{custom_addr}")
    assert res.status_code == 200, f"Explain failed: {res.text}"
    explain_data = res.json()
    print("  -> Base Risk Value:", explain_data["base_risk_value"])
    print("  -> Feature Contributions:", explain_data["feature_contributions"])
    for feat in ["repayment_history", "high_risk_tx", "wallet_age", "balance_stability"]:
        assert feat in explain_data["feature_contributions"], f"Missing {feat} in explanation"

    # 6. Test POST /verify/{wallet_id} (On-Chain Write)
    print(f"\n[6] Testing POST /verify/{custom_addr} (On-Chain Write)...")
    res = client.post(f"/verify/{custom_addr}")
    assert res.status_code == 200, f"Verify write failed: {res.text}"
    write_receipt = res.json()
    print("  -> Status:", write_receipt["status"])
    print("  -> Tx Hash:", write_receipt["tx_hash"])
    print("  -> Explorer URL:", write_receipt["explorer_url"])
    assert write_receipt["status"] == "confirmed"
    assert write_receipt["tx_hash"].startswith("0x")

    # 7. Test GET /verify/{wallet_id} (On-Chain Proof Verification)
    print(f"\n[7] Testing GET /verify/{custom_addr} (On-Chain Proof Verification)...")
    res = client.get(f"/verify/{custom_addr}")
    assert res.status_code == 200, f"Verify read failed: {res.text}"
    read_proof = res.json()
    print("  -> Verified:", read_proof["verified"])
    print("  -> On-Chain Hash:", read_proof["on_chain_hash"])
    print("  -> Expected Hash:", read_proof["expected_hash"])
    print("  -> Explorer URL:", read_proof["explorer_url"])
    assert read_proof["verified"] is True
    assert read_proof["on_chain_hash"] == read_proof["expected_hash"]

    print("\n==================================================")
    print(" ALL 7 END-TO-END PIPELINE TESTS PASSED 100%!     ")
    print("==================================================")


if __name__ == "__main__":
    run_all_tests()
