"""
DeFi Risk RAG Knowledge Base.
A curated text corpus of DeFi risk concepts that grounds Gemini explanations.
Uses TF-IDF similarity for retrieval — no vector DB dependency required.

Each document is tagged with:
  - topic: the concept area
  - text: the passage to retrieve
  - keywords: for boosted matching

The retrieved passages are injected into the Gemini prompt so the LLM
cannot hallucinate unsupported DeFi-specific claims.
"""

import math
import re
from typing import List, Dict, Tuple

# ── Knowledge Corpus ─────────────────────────────────────────────────────────
# Written as factual, citable statements about DeFi risk factors.
# The LLM is only allowed to reason within these passages.

KNOWLEDGE_DOCUMENTS: List[Dict] = [
    # ── Repayment / Credit ────────────────────────────────────────────────
    {
        "id": "repay-001",
        "topic": "repayment_ratio",
        "keywords": ["repayment", "repay", "credit", "loan", "borrow", "default"],
        "text": (
            "Repayment ratio measures the fraction of borrowed funds returned on time. "
            "A ratio above 0.80 indicates strong credit discipline and historically correlates "
            "with low default rates in DeFi protocols. "
            "Below 0.40, the wallet has missed or defaulted on a significant portion of debts, "
            "which is a primary predictor of future default in lending risk models."
        ),
    },
    {
        "id": "repay-002",
        "topic": "repayment_ratio",
        "keywords": ["repayment", "defi lending", "aave", "compound", "credit score"],
        "text": (
            "In DeFi protocols such as Aave and Compound, a wallet's repayment history is "
            "a critical underwriting signal. Unlike traditional finance, DeFi repayment is "
            "fully on-chain and verifiable without requiring a credit bureau. "
            "Wallets with repayment ratio > 0.85 are considered prime borrowers; "
            "those below 0.50 are treated as subprime with elevated liquidation risk."
        ),
    },

    # ── High-Risk Transactions ────────────────────────────────────────────
    {
        "id": "riskytx-001",
        "topic": "high_risk_tx_count",
        "keywords": ["mixer", "tornado", "high risk", "risky transaction", "obfuscation"],
        "text": (
            "High-risk transactions include interactions with coin mixers (e.g., Tornado Cash), "
            "flash loan exploits, or protocols flagged by on-chain analytics as high-risk. "
            "A count above 8 suggests deliberate obfuscation of funds or aggressive speculative "
            "behavior, both of which increase the probability of default or fraudulent activity."
        ),
    },
    {
        "id": "riskytx-002",
        "topic": "high_risk_tx_count",
        "keywords": ["flash loan", "arbitrage", "exploit", "sandwich attack", "mev"],
        "text": (
            "High-risk transaction counts also capture MEV (Maximal Extractable Value) bots, "
            "sandwich attacks, and aggressive arbitrage. While some of these are benign, "
            "wallets with consistently high counts tend to have higher balance volatility "
            "and shorter effective wallet lifetimes, increasing credit risk."
        ),
    },

    # ── Wallet Age ────────────────────────────────────────────────────────
    {
        "id": "age-001",
        "topic": "wallet_age_days",
        "keywords": ["wallet age", "account age", "new wallet", "sybil", "identity"],
        "text": (
            "Wallet age is the number of days since the wallet's first on-chain transaction. "
            "Wallets under 60 days old are considered new and have insufficient history for "
            "credit assessment. They also carry higher Sybil-attack risk — meaning they could "
            "be disposable wallets created to exploit lending protocols. "
            "Wallets over 365 days with consistent activity are considered mature and lower-risk."
        ),
    },
    {
        "id": "age-002",
        "topic": "wallet_age_days",
        "keywords": ["wallet history", "account maturity", "track record"],
        "text": (
            "In DeFi credit scoring, wallet age serves a similar role to credit history length "
            "in traditional finance. A longer verified history provides more data points for "
            "risk assessment and reduces uncertainty. Short wallet age combined with high borrow "
            "counts is a red flag pattern associated with protocol farming and exit strategies."
        ),
    },

    # ── Balance Stability ─────────────────────────────────────────────────
    {
        "id": "stab-001",
        "topic": "balance_stability",
        "keywords": ["balance stability", "volatility", "cashflow", "collateral", "stable"],
        "text": (
            "Balance stability measures the coefficient of variation of a wallet's ETH/stablecoin "
            "balance over its lifetime. A high stability score (above 70) indicates consistent "
            "collateral levels and predictable cashflow. Low stability (below 30) suggests "
            "boom-bust cycles, which create under-collateralization risk during market downturns."
        ),
    },
    {
        "id": "stab-002",
        "topic": "balance_stability",
        "keywords": ["liquidation", "under-collateral", "margin call", "collateral ratio"],
        "text": (
            "Under-collateralization occurs when a wallet's collateral value drops below the "
            "protocol's liquidation threshold. Wallets with low balance stability are more "
            "likely to be auto-liquidated during market volatility because they do not maintain "
            "buffer collateral. This leads to cascading liquidations and loss of protocol funds."
        ),
    },

    # ── Liquidations ──────────────────────────────────────────────────────
    {
        "id": "liq-001",
        "topic": "liquidation_count",
        "keywords": ["liquidation", "liquidated", "margin call", "health factor"],
        "text": (
            "A liquidation event occurs when a wallet's health factor drops below 1.0, "
            "triggering automatic sale of collateral to repay debt. Each liquidation event "
            "represents a failure of the wallet to maintain adequate collateral ratios. "
            "Wallets with more than 3 liquidation events have demonstrated repeated inability "
            "to manage DeFi debt positions responsibly."
        ),
    },
    {
        "id": "liq-002",
        "topic": "liquidation_count",
        "keywords": ["liquidation penalty", "bad debt", "protocol loss", "aave liquidation"],
        "text": (
            "Liquidations in DeFi protocols like Aave carry a liquidation penalty (typically 5–15%). "
            "Repeated liquidations erode wallet capital and signal poor risk management. "
            "In extreme cases, if liquidation cannot cover the full debt (bad debt), "
            "the protocol absorbs the loss, harming all liquidity providers. "
            "High liquidation counts are among the strongest predictors of future default."
        ),
    },

    # ── Historical Default ────────────────────────────────────────────────
    {
        "id": "default-001",
        "topic": "historical_default",
        "keywords": ["default", "historical default", "bad debt", "write-off"],
        "text": (
            "A historical default flag indicates that the wallet has previously caused "
            "irrecoverable losses to a DeFi protocol — i.e., the protocol had to write off "
            "bad debt associated with this address. This is the single most severe individual "
            "risk signal. A wallet with even one prior default should be treated as high-risk "
            "unless there is substantial subsequent evidence of rehabilitation."
        ),
    },

    # ── Transaction Count ─────────────────────────────────────────────────
    {
        "id": "txcount-001",
        "topic": "transaction_count",
        "keywords": ["transaction count", "activity", "on-chain activity", "tx count"],
        "text": (
            "Transaction count reflects a wallet's overall on-chain activity level. "
            "Very low counts (under 10) may indicate a wallet with insufficient history. "
            "Moderate activity (50–500) correlates with genuine DeFi participation. "
            "Extremely high counts combined with high-risk tx ratios may indicate bot activity."
        ),
    },

    # ── Protocol Diversity ────────────────────────────────────────────────
    {
        "id": "proto-001",
        "topic": "protocol_count",
        "keywords": ["protocol", "protocol diversity", "defi ecosystem", "multi-protocol"],
        "text": (
            "Protocol diversity — the number of distinct DeFi protocols a wallet has interacted with — "
            "is a positive signal when moderate (5–15 protocols). It indicates ecosystem engagement "
            "and financial sophistication. However, very low diversity (1–2 protocols) may indicate "
            "limited experience, while very high diversity with short wallet age can indicate "
            "systematic protocol farming behavior."
        ),
    },

    # ── Failed Transactions ───────────────────────────────────────────────
    {
        "id": "fail-001",
        "topic": "failed_transactions",
        "keywords": ["failed transaction", "reverted", "out of gas", "error"],
        "text": (
            "Failed on-chain transactions (reverted calls) indicate that a wallet has "
            "attempted operations that could not complete successfully. A small number (1–5) "
            "is normal. High counts of failed transactions relative to total transactions suggest "
            "aggressive automated strategies, MEV bot activity, or misconfigured smart contract "
            "interactions — all of which raise risk assessment flags."
        ),
    },

    # ── Large Transaction Ratio ───────────────────────────────────────────
    {
        "id": "largetx-001",
        "topic": "large_tx_ratio",
        "keywords": ["large transaction", "whale", "concentration risk", "big transfer"],
        "text": (
            "Large transaction ratio measures the fraction of transactions exceeding 5 ETH in value. "
            "A high ratio (above 0.40) indicates a 'whale' pattern — few but large moves — which "
            "introduces concentration risk. Large infrequent transactions are harder to underwrite "
            "because they can represent one-time capital events rather than sustainable income streams."
        ),
    },

    # ── Nonlinear Interactions ────────────────────────────────────────────
    {
        "id": "interact-001",
        "topic": "interaction_effects",
        "keywords": ["combination", "interaction", "compound risk", "multiple factors"],
        "text": (
            "DeFi credit risk is rarely determined by a single factor. Compound risk effects "
            "arise when multiple moderate signals combine: e.g., high-risk transaction count "
            "alone is acceptable if paired with long wallet age and high repayment. "
            "However, high tx-risk + low repayment + new wallet creates a strongly amplified "
            "risk signal that no single metric reveals in isolation. Risk models must capture "
            "these nonlinear interactions to avoid both over-approval and over-rejection."
        ),
    },
    {
        "id": "interact-002",
        "topic": "interaction_effects",
        "keywords": ["default pattern", "risk pattern", "red flag", "warning signs"],
        "text": (
            "Common high-risk pattern combinations in DeFi: "
            "(1) historical_default=1 + repayment_ratio < 0.40: extremely high re-default probability; "
            "(2) new wallet (< 90 days) + high borrow_count: likely farming/exit scheme; "
            "(3) multiple liquidations + low balance stability: chronic collateral mismanagement; "
            "(4) high failed_transactions + high large_tx_ratio: aggressive automated strategy. "
            "The risk model penalizes these combinations superlinearly."
        ),
    },

    # ── XAI and Model Transparency ────────────────────────────────────────
    {
        "id": "xai-001",
        "topic": "xai_model_transparency",
        "keywords": ["shap", "explainability", "feature attribution", "model transparency", "xai"],
        "text": (
            "SHAP (SHapley Additive exPlanations) decomposes the model's prediction into per-feature "
            "contributions by computing the average marginal contribution of each feature across "
            "all possible feature orderings. A positive SHAP value means the feature pushes the "
            "risk score above the baseline; negative means it reduces risk. "
            "SHAP values are model-agnostic and work on the Quantum SVC by treating it as a black box."
        ),
    },
    {
        "id": "xai-002",
        "topic": "xai_audit",
        "keywords": ["faithfulness", "stability", "sensitivity", "audit", "explanation quality"],
        "text": (
            "XAI explanation quality is assessed on three dimensions: "
            "(1) Faithfulness — perturbing a high-attribution feature should change the prediction proportionally; "
            "(2) Stability — nearly identical wallets should receive consistent SHAP rankings; "
            "(3) Sensitivity — moving each feature in the risky direction should monotonically increase risk. "
            "An explanation can be labelled SUPPORTED only if all three pass. "
            "SUPPORTED WITH CAUTION means one or two dimensions show weakness. "
            "QUESTIONABLE means the explanation should not be relied on for the decision."
        ),
    },

    # ── Quantum ML ────────────────────────────────────────────────────────
    {
        "id": "qml-001",
        "topic": "quantum_ml",
        "keywords": ["quantum", "qsvc", "quantum kernel", "zzfeaturemap", "quantum machine learning"],
        "text": (
            "The risk model uses a Quantum Support Vector Classifier (QSVC) with a ZZFeatureMap "
            "quantum kernel computed on a 6-qubit Aer statevector simulator. "
            "The ZZFeatureMap encodes feature values as quantum phase angles, creating "
            "entangled feature representations that classical kernels cannot efficiently replicate. "
            "The model is compared against XGBoost and Classical SVM baselines on identical data "
            "to verify that the quantum approach provides measurable value rather than serving as decoration."
        ),
    },

    # ── Blockchain Proof ──────────────────────────────────────────────────
    {
        "id": "bc-001",
        "topic": "blockchain_proof",
        "keywords": ["blockchain", "hash", "keccak256", "immutable", "proof", "on-chain"],
        "text": (
            "The decision record is committed to the Sepolia blockchain as a Keccak256 hash "
            "of a canonical JSON record containing: wallet ID, model version, risk score, decision, "
            "all input features, SHAP attributions, and XAI audit results. "
            "This hash provides an immutable commitment to the complete decision context — "
            "not just the outcome — making the record independently verifiable. "
            "Blockchain does not prove the AI decision is correct; it proves what the AI decided "
            "and what explanation was recorded at the time of the decision."
        ),
    },
]


# ── TF-IDF Retrieval ──────────────────────────────────────────────────────────

def _tokenize(text: str) -> List[str]:
    return re.findall(r"[a-z0-9_]+", text.lower())


def _build_tfidf_index(docs: List[Dict]) -> Tuple[List[List[str]], Dict[str, float]]:
    """Compute term frequencies and IDF for the corpus."""
    tokenized = [_tokenize(d["text"] + " " + " ".join(d.get("keywords", []))) for d in docs]
    N = len(tokenized)
    df: Dict[str, int] = {}
    for toks in tokenized:
        for t in set(toks):
            df[t] = df.get(t, 0) + 1
    idf = {t: math.log((N + 1) / (cnt + 1)) + 1 for t, cnt in df.items()}
    return tokenized, idf


_TOKENIZED_DOCS, _IDF = _build_tfidf_index(KNOWLEDGE_DOCUMENTS)


def _tfidf_vector(tokens: List[str], idf: Dict[str, float]) -> Dict[str, float]:
    tf: Dict[str, float] = {}
    for t in tokens:
        tf[t] = tf.get(t, 0) + 1
    n = max(len(tokens), 1)
    return {t: (cnt / n) * idf.get(t, 1.0) for t, cnt in tf.items()}


def _cosine(a: Dict[str, float], b: Dict[str, float]) -> float:
    keys = set(a) & set(b)
    if not keys:
        return 0.0
    dot = sum(a[k] * b[k] for k in keys)
    mag_a = math.sqrt(sum(v * v for v in a.values()))
    mag_b = math.sqrt(sum(v * v for v in b.values()))
    return dot / (mag_a * mag_b + 1e-12)


def retrieve_passages(
    query: str,
    top_k: int = 4,
    boost_topics: List[str] = None,
) -> List[Dict]:
    """
    Retrieve the top-k most relevant knowledge passages for a query.

    Args:
        query:         The retrieval query (usually built from feature names + shap values).
        top_k:         Number of passages to return.
        boost_topics:  Topics to up-rank (e.g., the top SHAP feature names).

    Returns:
        List of document dicts with an added 'similarity' key, sorted by relevance.
    """
    q_tokens = _tokenize(query)
    q_vec = _tfidf_vector(q_tokens, _IDF)

    scored = []
    for i, doc in enumerate(KNOWLEDGE_DOCUMENTS):
        doc_vec = _tfidf_vector(_TOKENIZED_DOCS[i], _IDF)
        sim = _cosine(q_vec, doc_vec)

        # Topic boost: if a high-SHAP feature maps to this doc's topic, bump it
        if boost_topics:
            topic = doc.get("topic", "")
            for bt in boost_topics:
                if bt in topic or topic in bt:
                    sim *= 1.4
                    break

        scored.append((sim, doc))

    scored.sort(key=lambda x: -x[0])
    results = []
    seen_topics = set()
    for sim, doc in scored:
        # Deduplicate by topic unless it's clearly most relevant
        topic = doc.get("topic", "")
        if topic in seen_topics and sim < 0.15:
            continue
        seen_topics.add(topic)
        result = dict(doc)
        result["similarity"] = round(sim, 4)
        results.append(result)
        if len(results) >= top_k:
            break

    return results


def build_retrieval_query(shap_result: Dict, audit_result: Dict) -> Tuple[str, List[str]]:
    """
    Build a retrieval query from SHAP attributions + audit results.
    Returns (query_string, boost_topics).
    """
    contributions = shap_result.get("feature_contributions", {})
    sorted_feats = sorted(contributions.items(), key=lambda x: -abs(x[1]))

    # Build query from top features + audit verdict
    query_parts = []
    boost_topics = []

    for feat_display, shap_val in sorted_feats[:5]:
        query_parts.append(feat_display.replace("_", " "))
        boost_topics.append(feat_display)

    overall = audit_result.get("overall_verdict", "")
    if "CAUTION" in overall or "QUESTIONABLE" in overall:
        query_parts.append("xai audit explanation quality faithfulness stability")
    if shap_result.get("risk_score", 0) > 60:
        query_parts.append("high risk default liquidation")
    query_parts.append("defi risk credit lending")

    return " ".join(query_parts), boost_topics
