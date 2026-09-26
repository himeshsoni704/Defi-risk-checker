import type { AuditDimension, XAIAuditReport } from "@/lib/api";

function verdictClass(verdict: string): string {
  if (verdict === "HIGH") return "verdict v-high";
  if (verdict === "MEDIUM") return "verdict v-med";
  return "verdict v-low";
}

function Row({ name, dim }: { name: string; dim: AuditDimension }) {
  return (
    <div className="audit-dim">
      <strong>{name}</strong>
      <div style={{ color: "var(--muted)", fontSize: 14 }}>{dim.description}</div>
      <span className={verdictClass(dim.verdict)}>
        {dim.display_level ?? dim.verdict}
      </span>
    </div>
  );
}

export default function AuditPanel({ audit }: { audit: XAIAuditReport }) {
  return (
    <div>
      <Row name="Faithfulness" dim={audit.faithfulness} />
      <Row name="Stability" dim={audit.stability} />
      <Row name="Sensitivity" dim={audit.sensitivity} />
      <div className="overall">
        <div style={{ fontWeight: 700, marginBottom: 8 }}>
          Overall: {audit.overall_verdict}
        </div>
        <p style={{ color: "var(--muted)", margin: "0 0 10px", fontSize: 14 }}>
          {audit.overall_description}
        </p>
        {audit.summary_lines?.map((line) => (
          <div className="summary-line" key={line}>
            {line}
          </div>
        ))}
      </div>
    </div>
  );
}
