import { labelFor } from "@/lib/api";

export default function ContributionChart({
  contributions,
}: {
  contributions: Record<string, number>;
}) {
  const entries = Object.entries(contributions).sort(
    (a, b) => Math.abs(b[1]) - Math.abs(a[1]),
  );
  const max = Math.max(1, ...entries.map(([, v]) => Math.abs(v)));

  return (
    <div>
      {entries.map(([key, value]) => {
        const pct = (Math.abs(value) / max) * 50; // half-width max
        const positive = value >= 0;
        return (
          <div className="bar-row" key={key}>
            <span title={key}>{labelFor(key)}</span>
            <div className="bar-track">
              <span className="bar-mid" />
              <span
                className={`bar-fill ${positive ? "bar-pos" : "bar-neg"}`}
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="bar-val">
              {positive ? "+" : ""}
              {value.toFixed(1)}
            </span>
          </div>
        );
      })}
      <div className="hint">
        Bars to the right (red) increase risk; bars to the left (green) reduce
        risk. Values are SHAP attribution points.
      </div>
    </div>
  );
}
