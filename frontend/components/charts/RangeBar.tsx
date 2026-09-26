import type { FeatureMeta } from "@/lib/features";

/** Where a feature value sits inside the dataset's documented range. */
export default function RangeBar({ meta, value }: { meta: FeatureMeta; value: number }) {
  const pct = Math.max(0, Math.min(1, (value - meta.min) / (meta.max - meta.min || 1)));
  return (
    <div
      style={{ position: "relative", height: 4, borderRadius: 2, background: "var(--surface-3)", minWidth: 80 }}
      title={`Range ${meta.min}–${meta.max}`}
      aria-hidden
    >
      <div
        style={{
          position: "absolute",
          left: `calc(${pct * 100}% - 4px)`,
          top: -3,
          width: 8,
          height: 10,
          borderRadius: 2,
          background: meta.quantum ? "var(--accent)" : "var(--text-3)",
        }}
      />
    </div>
  );
}
