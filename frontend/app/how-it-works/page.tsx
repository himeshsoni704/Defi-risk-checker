export default function HowItWorks() {
  return (
    <main>
      <section className="page-head">
        <div className="container">
          <h1>How it works</h1>
          <p>From a wallet address to a verifiable, explained decision.</p>
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="card">
            <h3>1 · Feature extraction</h3>
            <p>
              Twelve on-chain risk features are gathered (wallet age,
              transaction count, repayment ratio, liquidation count, high-risk
              transactions, balance stability, historical default, and more).
            </p>
          </div>
          <br />
          <div className="card">
            <h3>2 · Quantum risk score</h3>
            <p>
              Six features are encoded into a ZZ feature map and evaluated by a
              quantum support vector classifier (QSVC) running on a statevector
              simulator. The output is a continuous risk score from 0 to 100.
              Scores at or above 50 are denied.
            </p>
          </div>
          <br />
          <div className="card">
            <h3>3 · Explanation (SHAP)</h3>
            <p>
              A SHAP kernel explainer treats the model as a black box and
              attributes the score to each feature. Positive attributions raise
              risk; negative attributions lower it.
            </p>
          </div>
          <br />
          <div className="card">
            <h3>4 · Explanation audit</h3>
            <p>
              The explanation is tested three ways:{" "}
              <strong>faithfulness</strong> (does changing a highlighted feature
              actually move the score?), <strong>stability</strong> (do
              near-identical wallets produce consistent explanations?), and{" "}
              <strong>sensitivity</strong> (does worsening a risky feature
              consistently raise risk?).
            </p>
          </div>
          <br />
          <div className="card">
            <h3>5 · Canonical record &amp; blockchain</h3>
            <p>
              The wallet id, model version, score, decision, all features, the
              explanation and the audit result are combined into a canonical
              JSON record and hashed with Keccak256. That hash is anchored
              on-chain so anyone can later verify the displayed decision matches
              what was committed.
            </p>
            <ul className="flow">
              <li>
                <strong>Verify write</strong> — anchor the hash on-chain.
              </li>
              <li>
                <strong>Verify read</strong> — compare the on-chain hash to the
                freshly computed record.
              </li>
            </ul>
          </div>
        </div>
      </section>
    </main>
  );
}
