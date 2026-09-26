/**
 * A Keccak256 hash drawn as 32 cells, one per byte, in an 8×4 grid. Byte value
 * sets the lightness, so two hashes can be compared at a glance. When `compare`
 * is given, bytes that differ are outlined.
 */
export default function HashFingerprint({ hash, compare, hue = 250 }: { hash: string; compare?: string | null; hue?: number }) {
  const hex = hash.replace(/^0x/i, "").toLowerCase();
  const other = compare?.replace(/^0x/i, "").toLowerCase();
  const bytes: number[] = [];
  for (let i = 0; i < 64; i += 2) bytes.push(parseInt(hex.slice(i, i + 2) || "0", 16));
  return (
    <div className="fingerprint" role="img" aria-label={`Fingerprint of ${hash}`}>
      {bytes.map((b, i) => {
        const diff = other ? other.slice(i * 2, i * 2 + 2) !== hex.slice(i * 2, i * 2 + 2) : false;
        const l = 14 + (b / 255) * 58;
        return (
          <span
            key={i}
            className="fp-cell"
            data-diff={diff ? "true" : "false"}
            title={`byte ${i}: 0x${hex.slice(i * 2, i * 2 + 2)}`}
            style={{ background: `hsl(${hue} ${diff ? 0 : 70}% ${l}%)`, "--i": i } as React.CSSProperties}
          />
        );
      })}
    </div>
  );
}
