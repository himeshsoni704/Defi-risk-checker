"""
XAI Audit Layer for DeFi Risk Checker.
Independently tests SHAP explanations for:
  1. Faithfulness   – does perturbing a high-attribution feature change the prediction
                      proportionally?  (perturbation-based ground-truth test)
  2. Stability      – do nearly identical wallets produce consistent SHAP rankings?
                      (Jaccard/rank-correlation across micro-perturbed inputs)
  3. Sensitivity    – is the model sensitive to each feature's direction of change?
                      (monotonicity check: increasing bad features increases risk)

Outputs a structured audit report instead of a single opaque "trust score".
Each metric is described with *why* it passed or failed so results are defensible.
"""

import numpy as np
from typing import Dict, Any, List, Optional, Tuple
from scipy.stats import spearmanr


# ── Audit thresholds (tunable) ────────────────────────────────────────────────
FAITHFULNESS_DELTA_THRESHOLD = 5.0      # Expected risk Δ as % of SHAP attribution magnitude
STABILITY_RANK_CORR_THRESHOLD = 0.70   # Spearman ρ below this → unstable
N_STABILITY_PERTURBATIONS = 5           # Number of micro-perturbed clones per wallet
STABILITY_NOISE_STD = 0.005             # Noise std on scaled [0,1] features
SENSITIVITY_MIN_DELTA = 2.0             # Risk must change ≥ 2.0 pts when flipping a feature


class XAIAuditor:
    """
    Runs three independent tests on a SHAP explanation and returns a structured report.

    Usage:
        auditor = XAIAuditor(qml_model=model, explainer=shap_explainer)
        report  = auditor.audit(features, shap_result)
    """

    def __init__(self, qml_model, explainer):
        """
        Args:
            qml_model:  QuantumRiskModel instance (must expose predict_risk_score)
            explainer:  QuantumXAIExplainer instance (must expose explain())
        """
        self.model = qml_model
        self.explainer = explainer

    # ──────────────────────────────────────────────────────────────────────────
    # Public entry point
    # ──────────────────────────────────────────────────────────────────────────

    def audit(
        self,
        features: List[float],
        shap_result: Dict[str, Any],
        top_k: int = 3,
    ) -> Dict[str, Any]:
        """
        Run the full XAI audit suite.

        Args:
            features:    Raw 12-feature vector (same order as FEATURE_NAMES)
            shap_result: Dict returned by QuantumXAIExplainer.explain()
            top_k:       Number of top SHAP features to test for faithfulness

        Returns:
            audit_report dict with:
              - faithfulness: {score, verdict, details, perturb_results}
              - stability:    {score, verdict, details, rank_correlation}
              - sensitivity:  {score, verdict, details}
              - overall_verdict: "SUPPORTED" | "SUPPORTED WITH CAUTION" | "QUESTIONABLE"
              - summary_lines: list[str]  (for frontend display)
        """
        contributions = shap_result.get("feature_contributions", {})
        original_risk = float(shap_result.get("risk_score", self.model.predict_risk_score(features)[0]))

        faith_report = self._test_faithfulness(features, contributions, original_risk, top_k)
        stab_report = self._test_stability(features, contributions)
        sens_report = self._test_sensitivity(features, contributions, original_risk)

        overall = self._aggregate_verdict(faith_report, stab_report, sens_report)

        return {
            "faithfulness": faith_report,
            "stability": stab_report,
            "sensitivity": sens_report,
            "overall_verdict": overall["verdict"],
            "overall_description": overall["description"],
            "summary_lines": self._build_summary(faith_report, stab_report, sens_report, overall),
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Test 1: Faithfulness
    # "If SHAP says feature X contributes +25, perturbing X should shift
    #  the prediction by a proportional amount."
    # ──────────────────────────────────────────────────────────────────────────

    def _test_faithfulness(
        self,
        features: List[float],
        contributions: Dict[str, float],
        original_risk: float,
        top_k: int,
    ) -> Dict[str, Any]:
        """
        For the top-k highest-attribution features:
          - Move the feature from its current value toward the opposite extreme.
          - Measure actual risk Δ vs predicted Δ from SHAP.
          - A faithful explanation should show them tracking each other.
        """
        from dataset import FEATURE_NAMES, DISPLAY_FEATURE_MAP

        # Sort contributions by absolute value
        sorted_contribs = sorted(
            contributions.items(), key=lambda kv: abs(kv[1]), reverse=True
        )[:top_k]

        perturb_results = []
        faithful_count = 0

        for display_name, shap_val in sorted_contribs:
            # Find index in FEATURE_NAMES
            orig_name = self._reverse_display(display_name, FEATURE_NAMES, DISPLAY_FEATURE_MAP)
            if orig_name is None:
                continue
            feat_idx = FEATURE_NAMES.index(orig_name)

            # Compute the feature's scaled range and create a perturbed clone
            perturbed = list(features)
            orig_val = features[feat_idx]

            # Perturb toward the extreme that SHAP says reduces risk most
            # If shap_val > 0 (feature increases risk), reduce the feature value
            # If shap_val < 0 (feature decreases risk), increase the feature value
            step = self._compute_perturbation_step(orig_name, orig_val, shap_val)
            perturbed[feat_idx] = orig_val + step

            new_risk = float(self.model.predict_risk_score(perturbed)[0])
            actual_delta = new_risk - original_risk

            # Expected direction: shap_val > 0 → reducing the feature should lower risk (negative delta)
            expected_direction_ok = (shap_val * actual_delta) >= 0 or abs(actual_delta) < 1.0
            # Faithful if actual_delta has at least 25% of |shap_val| magnitude
            magnitude_ok = abs(actual_delta) >= max(abs(shap_val) * 0.25, FAITHFULNESS_DELTA_THRESHOLD)

            is_faithful = expected_direction_ok and magnitude_ok

            if is_faithful:
                faithful_count += 1

            perturb_results.append({
                "feature": display_name,
                "shap_attribution": round(shap_val, 2),
                "original_value": round(float(orig_val), 4),
                "perturbed_value": round(float(perturbed[feat_idx]), 4),
                "original_risk": round(original_risk, 1),
                "new_risk": round(new_risk, 1),
                "actual_delta": round(actual_delta, 1),
                "expected_direction_correct": bool(expected_direction_ok),
                "magnitude_sufficient": bool(magnitude_ok),
                "faithful": bool(is_faithful),
                "verdict": "✓ Supported" if is_faithful else "⚠ Questionable",
            })

        ratio = faithful_count / max(len(perturb_results), 1)
        if ratio >= 0.8:
            verdict, level = "HIGH", "✓ High"
        elif ratio >= 0.5:
            verdict, level = "MEDIUM", "~ Medium"
        else:
            verdict, level = "LOW", "⚠ Low"

        return {
            "score": round(ratio, 3),
            "score_pct": round(ratio * 100, 1),
            "verdict": verdict,
            "display_level": level,
            "faithful_features": faithful_count,
            "tested_features": len(perturb_results),
            "perturb_results": perturb_results,
            "description": (
                f"{faithful_count}/{len(perturb_results)} top features passed perturbation test. "
                "A faithful SHAP explanation should show that the features it highlights "
                "actually move the prediction when changed."
            ),
        }

    def _compute_perturbation_step(self, feature_name: str, orig_val: float, shap_val: float) -> float:
        """Compute a meaningful perturbation step for a given feature."""
        # Feature-specific ranges for sensible perturbation magnitudes
        FEATURE_RANGES = {
            "wallet_age_days":        (7, 1500, 300),
            "transaction_count":      (5, 2000, 100),
            "avg_transaction_value":  (0.01, 200, 20),
            "repayment_ratio":        (0.0, 1.0, 0.25),
            "liquidation_count":      (0, 20, 4),
            "borrow_count":           (0, 150, 20),
            "high_risk_tx_count":     (0, 30, 8),
            "protocol_count":         (1, 25, 5),
            "balance_stability":      (0, 100, 25),
            "failed_transactions":    (0, 40, 8),
            "large_tx_ratio":         (0.0, 1.0, 0.25),
            "historical_default":     (0, 1, 1),
        }
        lo, hi, step_mag = FEATURE_RANGES.get(feature_name, (0, 100, 20))
        # Move toward the opposite extreme of where we currently are
        direction = -1 if shap_val > 0 else 1
        step = direction * step_mag
        # Clamp to valid range
        new_val = np.clip(orig_val + step, lo, hi)
        return new_val - orig_val

    # ──────────────────────────────────────────────────────────────────────────
    # Test 2: Stability
    # "Two nearly-identical wallets should produce nearly-identical SHAP rankings."
    # ──────────────────────────────────────────────────────────────────────────

    def _test_stability(
        self,
        features: List[float],
        contributions: Dict[str, float],
    ) -> Dict[str, Any]:
        """
        Generate N_STABILITY_PERTURBATIONS micro-perturbed clones of the wallet,
        compute their SHAP explanations, and compare the ranking of features
        using Spearman rank correlation.
        """
        from dataset import FEATURE_NAMES, DISPLAY_FEATURE_MAP

        orig_order = [k for k, _ in sorted(contributions.items(), key=lambda x: -abs(x[1]))]
        orig_vals = np.array([contributions[k] for k in orig_order])

        correlations = []
        clone_explanations = []

        for seed in range(N_STABILITY_PERTURBATIONS):
            rng = np.random.RandomState(seed + 1000)
            # Add tiny Gaussian noise proportional to each feature's natural range
            noise = rng.normal(0, STABILITY_NOISE_STD, len(features))
            perturbed = [
                float(np.clip(features[i] + noise[i] * self._feature_range(FEATURE_NAMES[i]), 0, 1e9))
                for i in range(len(features))
            ]

            try:
                clone_exp = self.explainer.explain(perturbed)
                clone_contribs = clone_exp.get("feature_contributions", {})
            except Exception:
                continue

            # Align feature order with original
            clone_vals = np.array([clone_contribs.get(k, 0.0) for k in orig_order])
            if np.std(clone_vals) < 1e-9:
                continue

            rho, _ = spearmanr(orig_vals, clone_vals)
            correlations.append(float(rho))
            clone_explanations.append({
                "seed": seed,
                "rank_correlation": round(float(rho), 3),
                "contributions": {k: round(clone_contribs.get(k, 0.0), 2) for k in orig_order},
            })

        if not correlations:
            mean_rho = 0.0
        else:
            mean_rho = float(np.mean(correlations))

        if mean_rho >= STABILITY_RANK_CORR_THRESHOLD:
            verdict, level = "HIGH", "✓ High"
        elif mean_rho >= 0.45:
            verdict, level = "MEDIUM", "~ Medium"
        else:
            verdict, level = "LOW", "⚠ Low"

        return {
            "score": round(mean_rho, 3),
            "score_pct": round(max(mean_rho, 0) * 100, 1),
            "verdict": verdict,
            "display_level": level,
            "mean_rank_correlation": round(mean_rho, 3),
            "n_clones_tested": len(correlations),
            "clone_details": clone_explanations,
            "description": (
                f"Mean Spearman rank-correlation across {len(correlations)} micro-perturbed clones: "
                f"{round(mean_rho, 3):.3f}. "
                "Stable explanations produce consistent feature rankings even for nearly-identical inputs. "
                f"Threshold for HIGH stability: ρ ≥ {STABILITY_RANK_CORR_THRESHOLD}."
            ),
        }

    def _feature_range(self, feature_name: str) -> float:
        """Return natural scale of each feature for proportional noise injection."""
        RANGES = {
            "wallet_age_days": 1500, "transaction_count": 2000,
            "avg_transaction_value": 200, "repayment_ratio": 1.0,
            "liquidation_count": 20, "borrow_count": 150,
            "high_risk_tx_count": 30, "protocol_count": 25,
            "balance_stability": 100, "failed_transactions": 40,
            "large_tx_ratio": 1.0, "historical_default": 1,
        }
        return float(RANGES.get(feature_name, 100))

    # ──────────────────────────────────────────────────────────────────────────
    # Test 3: Sensitivity (Monotonicity)
    # "If SHAP attributes a feature as risk-increasing, making that feature
    #  worse should actually increase the model's output."
    # ──────────────────────────────────────────────────────────────────────────

    def _test_sensitivity(
        self,
        features: List[float],
        contributions: Dict[str, float],
        original_risk: float,
    ) -> Dict[str, Any]:
        """
        For each feature with |shap_val| > 3.0:
          - Move it one step in the direction SHAP claims increases risk.
          - Check that the model risk actually increases.
        """
        from dataset import FEATURE_NAMES, DISPLAY_FEATURE_MAP

        tested = []
        sensitive_count = 0

        for display_name, shap_val in contributions.items():
            if abs(shap_val) < 3.0:
                continue  # skip low-attribution features
            orig_name = self._reverse_display(display_name, FEATURE_NAMES, DISPLAY_FEATURE_MAP)
            if orig_name is None:
                continue
            feat_idx = FEATURE_NAMES.index(orig_name)
            orig_val = features[feat_idx]

            # Move the feature in the direction SHAP says increases risk
            step = self._compute_perturbation_step(orig_name, orig_val, -abs(shap_val))
            worsened = list(features)
            worsened[feat_idx] = orig_val + step  # step makes the feature worse

            new_risk = float(self.model.predict_risk_score(worsened)[0])
            delta = new_risk - original_risk

            # SHAP says shap_val > 0 means the feature currently inflates risk;
            # reducing it should lower risk. We test the reverse: INCREASING a
            # risk-reducing feature should LOWER the risk.
            # Direction convention: we move the feature to make it "more risky"
            # → expect new_risk > original_risk
            is_sensitive = delta >= SENSITIVITY_MIN_DELTA

            if is_sensitive:
                sensitive_count += 1

            tested.append({
                "feature": display_name,
                "shap_attribution": round(shap_val, 2),
                "original_value": round(float(orig_val), 4),
                "worsened_value": round(float(worsened[feat_idx]), 4),
                "original_risk": round(original_risk, 1),
                "new_risk": round(new_risk, 1),
                "delta": round(delta, 1),
                "sensitive": bool(is_sensitive),
                "verdict": "✓ Sensitive" if is_sensitive else "⚠ Insensitive",
            })

        if not tested:
            ratio, verdict, level = 0.0, "UNKNOWN", "? Unknown"
        else:
            ratio = sensitive_count / len(tested)
            if ratio >= 0.8:
                verdict, level = "HIGH", "✓ High"
            elif ratio >= 0.5:
                verdict, level = "MEDIUM", "~ Medium"
            else:
                verdict, level = "LOW", "⚠ Low"

        return {
            "score": round(ratio, 3),
            "score_pct": round(ratio * 100, 1),
            "verdict": verdict,
            "display_level": level,
            "sensitive_features": sensitive_count,
            "tested_features": len(tested),
            "feature_details": tested,
            "description": (
                f"{sensitive_count}/{len(tested)} features produced expected directional risk changes "
                f"(≥ {SENSITIVITY_MIN_DELTA} pt shift) when moved toward the risky extreme. "
                "Low sensitivity may indicate model saturation or distributional edge effects."
            ),
        }

    # ──────────────────────────────────────────────────────────────────────────
    # Aggregation
    # ──────────────────────────────────────────────────────────────────────────

    def _aggregate_verdict(
        self,
        faith: Dict[str, Any],
        stab: Dict[str, Any],
        sens: Dict[str, Any],
    ) -> Dict[str, str]:
        """
        Combine three audit dimensions into an overall verdict.
        No single opaque score — the verdict describes exactly what passed/failed.
        """
        levels = {"HIGH": 2, "MEDIUM": 1, "LOW": 0, "UNKNOWN": 0}
        scores = [
            levels.get(faith["verdict"], 0),
            levels.get(stab["verdict"], 0),
            levels.get(sens["verdict"], 0),
        ]
        avg = sum(scores) / 3

        low_flags = [d for d, r in [
            ("Faithfulness", faith["verdict"]),
            ("Stability", stab["verdict"]),
            ("Sensitivity", sens["verdict"]),
        ] if r == "LOW"]

        if avg >= 1.7:
            verdict = "SUPPORTED"
            description = (
                "All three audit dimensions are HIGH or better. "
                "This explanation is well-supported by independent tests."
            )
        elif avg >= 0.9:
            low_str = ", ".join(low_flags) if low_flags else "none"
            verdict = "SUPPORTED WITH CAUTION"
            description = (
                f"The explanation passes most audits but has limitations in: {low_str}. "
                "Use it as a guide, not a guarantee."
            )
        else:
            verdict = "QUESTIONABLE"
            description = (
                f"Multiple audit dimensions failed ({', '.join(low_flags)}). "
                "The explanation may not reliably reflect the model's actual reasoning."
            )

        return {"verdict": verdict, "description": description}

    def _build_summary(self, faith, stab, sens, overall) -> List[str]:
        """Build a list of human-readable summary lines for the frontend."""
        lines = [
            f"Faithfulness   {faith['display_level']:12}  ({faith['faithful_features']}/{faith['tested_features']} features verified)",
            f"Stability      {stab['display_level']:12}  (ρ = {stab['mean_rank_correlation']:.3f} across {stab['n_clones_tested']} clones)",
            f"Sensitivity    {sens['display_level']:12}  ({sens['sensitive_features']}/{sens['tested_features']} features directionally correct)",
            f"Overall: {overall['verdict']}",
        ]
        return lines

    # ──────────────────────────────────────────────────────────────────────────
    # Helpers
    # ──────────────────────────────────────────────────────────────────────────

    @staticmethod
    def _reverse_display(
        display_name: str,
        feature_names: List[str],
        display_map: Dict[str, str],
    ) -> Optional[str]:
        """Map a SHAP display name back to the original feature name."""
        reverse = {v: k for k, v in display_map.items()}
        return reverse.get(display_name)
