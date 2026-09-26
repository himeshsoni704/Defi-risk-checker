import Link from "next/link";

const layers = [
  {
    n: "01",
    title: "Quantum ML risk scoring",
    body: "A quantum support vector classifier (QSVC) reads 12 on-chain wallet features and produces a 0–100 risk score.",
  },
  {
    n: "02",
    title: "Explainable AI",
    body: "SHAP attributions break the score down into exactly which features pushed it up or down, and by how much.",
  },
  {
    n: "03",
    title: "Explanation audit",
    body: "Three independent tests (faithfulness, stability, sensitivity) check whether the explanation can be trusted.",
  },
  {
    n: "04",
    title: "Blockchain proof",
    body: "The whole record — score, features, explanation and audit — is hashed and anchored so it cannot be altered later.",
  },
];

export default function Home() {
  return (
    <main>
      <section className="hero">
        <div className="container">
          <span className="badge">
            Quantum ML · XAI · Blockchain Proof-of-Decision
          </span>
          <h1>
            Automated credit checks for{" "}
            <span className="gradient-text">crypto wallets</span>
          </h1>
          <p className="lead">
            DeFi Risk Checker scores a wallet&apos;s lending risk with a quantum
            machine learning model, explains the decision, independently audits
            that explanation, and anchors the whole record on-chain.
          </p>
          <div className="hero-actions">
            <Link href="/score" className="btn btn-primary">
              Score a wallet →
            </Link>
            <Link href="/how-it-works" className="btn btn-ghost">
              How it works
            </Link>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <h2 className="section-title">The full pipeline</h2>
          <p className="section-sub">
            Four layers, each making the previous one more trustworthy.
          </p>
          <div className="grid grid-4">
            {layers.map((l) => (
              <div className="card" key={l.n}>
                <span className="step-num">{l.n}</span>
                <h3>{l.title}</h3>
                <p>{l.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card" style={{ textAlign: "center", padding: 40 }}>
            <h2 className="section-title">Try it on a sample wallet</h2>
            <p className="section-sub" style={{ marginBottom: 22 }}>
              Pick a wallet from the dataset or paste any address to see its
              score, explanation and audit.
            </p>
            <Link href="/score" className="btn btn-primary">
              Open the scorer
            </Link>
          </div>
        </div>
      </section>
    </main>
  );
}
