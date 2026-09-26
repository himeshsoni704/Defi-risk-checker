export type TourRoute = "dashboard" | "assess" | "explain" | "audit" | "verify" | "models";

export interface TourStep {
  id: string;
  route: TourRoute;
  /** Value of the data-tour attribute to spotlight. Omit for a centered card. */
  target?: string;
  title: string;
  body: string;
  /** Shown while the target has not rendered yet (e.g. an analysis is running). */
  waitText?: string;
}

export const TOUR_STEPS: TourStep[] = [
  {
    id: "welcome",
    route: "dashboard",
    title: "A walk through the risk pipeline",
    body:
      "This tour follows one wallet through the whole product: score it with the quantum model, see which features drove the score, audit that explanation, and anchor the decision on-chain. Every number you see comes from the live API. Use ← → or the buttons to move, Esc to leave.",
  },
  {
    id: "status",
    route: "dashboard",
    target: "system-status",
    title: "System status",
    body:
      "A live strip from GET /health, refreshed every 30 seconds: API latency, the loaded QSVC model, whether proofs go to live Sepolia or the simulated provider, and how many decisions the server holds.",
  },
  {
    id: "quick",
    route: "dashboard",
    target: "quick-analysis",
    title: "Start with a wallet",
    body:
      "Paste any 0x address or pick one of the sample wallets. Addresses that exist in the 2,000-row dataset use their recorded features; unknown addresses fall back to the backend's neutral default profile, and the app tells you when that happens.",
  },
  {
    id: "field",
    route: "dashboard",
    target: "dataset-field",
    title: "The dataset at a glance",
    body:
      "200 wallets from GET /wallets, placed by wallet age and repayment ratio and colored by their ground-truth label. Hover any point for its features; click it to analyze that wallet. Wallets you have scored get a ring and their score.",
  },
  {
    id: "samples",
    route: "dashboard",
    target: "sample-wallets",
    title: "Sample wallets",
    body:
      "Rows from GET /wallets, alternating safe and risky. The label column is the dataset's ground truth, which is useful for checking whether the model agrees.",
  },
  {
    id: "recent",
    route: "dashboard",
    target: "recent-analyses",
    title: "Recent analyses",
    body:
      "Every wallet you score in this browser is listed here with its score, decision and audit verdict, so you can jump back into its explanation or proof.",
  },
  {
    id: "command",
    route: "dashboard",
    target: "command",
    title: "Jump anywhere with ⌘K",
    body: "Paste an address to analyze it, or search pages, recent analyses and dataset wallets. Works from every page with ⌘K or Ctrl+K.",
  },
  {
    id: "flow-nav",
    route: "dashboard",
    target: "nav-flow",
    title: "The four-step flow",
    body:
      "Assessment → Explanation → Audit → Verification. Steps fill in as the active wallet moves through them. Next, the tour opens the assessment for a dataset wallet.",
  },
  {
    id: "assess-input",
    route: "assess",
    target: "assess-input",
    title: "Run an assessment",
    body:
      "POST /score runs the full pipeline in one call: QSVC inference, SHAP attribution, the three-part explanation audit, and the Keccak256 hash of the canonical decision record. Scenario mode lets you override any of the 12 features.",
  },
  {
    id: "assess-result",
    route: "assess",
    target: "risk-result",
    waitText: "Running the analysis for the tour wallet…",
    title: "Risk score and decision",
    body:
      "The score is the QSVC's probability of default × 100. The model denies at 50 or above. The decision hash below commits to this exact result.",
  },
  {
    id: "assess-features",
    route: "assess",
    target: "feature-breakdown",
    waitText: "Waiting for the analysis…",
    title: "All 12 features",
    body:
      "Only six features enter the 6-qubit ZZFeatureMap circuit; the other six are recorded in the decision but cannot move this model's score. Each row shows its value, where it sits in the dataset range, and its SHAP attribution.",
  },
  {
    id: "assess-model",
    route: "assess",
    target: "model-info",
    waitText: "Waiting for the analysis…",
    title: "Model provenance",
    body: "The model ID, versions and training time returned with the score. These fields are part of the hashed record.",
  },
  {
    id: "explain-waterfall",
    route: "explain",
    target: "waterfall",
    waitText: "Loading the SHAP explanation…",
    title: "From baseline to score",
    body:
      "Kernel SHAP starts at the explainer's expected value and adds each feature's attribution until it reaches the model's score. Red steps push toward denial, green steps pull away from it. Any sampling residual is drawn explicitly.",
  },
  {
    id: "explain-bars",
    route: "explain",
    target: "contributions",
    waitText: "Loading the SHAP explanation…",
    title: "Feature contributions",
    body: "The same attributions ranked by size, with the input value that produced each one.",
  },
  {
    id: "explain-llm",
    route: "explain",
    target: "llm",
    waitText: "Loading the SHAP explanation…",
    title: "Plain-English explanation",
    body:
      "On request, GET /explain/llm asks Gemini for a summary grounded in the SHAP values, the audit and a small DeFi knowledge base. It only works when the server has GEMINI_API_KEY set; otherwise the app says so.",
  },
  {
    id: "audit-verdict",
    route: "audit",
    target: "audit-verdict",
    waitText: "Loading the audit report…",
    title: "Can the explanation be trusted?",
    body:
      "The audit tests the SHAP explanation against the model itself and gives one of three verdicts: Supported, Supported with caution, or Questionable.",
  },
  {
    id: "audit-dims",
    route: "audit",
    target: "audit-dimensions",
    waitText: "Loading the audit report…",
    title: "Faithfulness, stability, sensitivity",
    body:
      "Each test shows its pass rule and the individual experiments behind the score: perturbed features, micro-perturbed clones, and worsened inputs, with the model's risk before and after.",
  },
  {
    id: "verify-status",
    route: "verify",
    target: "verify-status",
    waitText: "Reading on-chain state…",
    title: "Proof of decision",
    body:
      "GET /verify compares the hash stored on-chain with the hash of the current decision record. Anchoring writes it with POST /verify after you confirm. Re-scoring a wallet creates a new record, so an older proof will show as a mismatch.",
  },
  {
    id: "verify-record",
    route: "verify",
    target: "canonical-record",
    waitText: "Reading on-chain state…",
    title: "What the hash commits to",
    body:
      "The canonical record: wallet, model version, score, decision, all features, SHAP attributions and audit results, serialized with sorted keys and hashed with Keccak256.",
  },
  {
    id: "models",
    route: "models",
    target: "model-table",
    waitText: "Loading model comparison…",
    title: "Model comparison",
    body:
      "Test-set metrics from GET /compare for the QSVC and the classical baselines trained on the same dataset. Nothing here is estimated by the frontend.",
  },
  {
    id: "done",
    route: "models",
    target: "tour-button",
    title: "That's the whole flow",
    body: "Restart this tour at any time from here. Pick a wallet on the dashboard to begin your own analysis.",
  },
];
