// Read-only JSON viewer with light syntax colouring. Keys are sorted the same
// way the backend sorts them before hashing (json.dumps(sort_keys=True)).

function sortKeys(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeys);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.keys(value as Record<string, unknown>)
        .sort()
        .map((k) => [k, sortKeys((value as Record<string, unknown>)[k])]),
    );
  }
  return value;
}

function renderValue(value: unknown, indent: number, key: string): React.ReactNode[] {
  const pad = "  ".repeat(indent);
  if (Array.isArray(value)) {
    if (value.length === 0) return ["[]"];
    const out: React.ReactNode[] = ["[\n"];
    value.forEach((v, i) => {
      out.push(pad + "  ", ...renderValue(v, indent + 1, `${key}.${i}`), i < value.length - 1 ? ",\n" : "\n");
    });
    out.push(pad + "]");
    return out;
  }
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>);
    if (entries.length === 0) return ["{}"];
    const out: React.ReactNode[] = ["{\n"];
    entries.forEach(([k, v], i) => {
      out.push(
        pad + "  ",
        <span className="k" key={`${key}.${k}.k`}>
          &quot;{k}&quot;
        </span>,
        ": ",
        ...renderValue(v, indent + 1, `${key}.${k}`),
        i < entries.length - 1 ? ",\n" : "\n",
      );
    });
    out.push(pad + "}");
    return out;
  }
  if (typeof value === "string")
    return [
      <span className="s" key={`${key}.s`}>
        &quot;{value}&quot;
      </span>,
    ];
  if (typeof value === "number")
    return [
      <span className="n" key={`${key}.n`}>
        {String(value)}
      </span>,
    ];
  return [
    <span className="b" key={`${key}.b`}>
      {String(value)}
    </span>,
  ];
}

export default function JsonView({ value, maxHeight }: { value: unknown; maxHeight?: number }) {
  return (
    <pre className="code-block" style={maxHeight ? { maxHeight } : undefined} tabIndex={0}>
      {renderValue(sortKeys(value), 0, "root")}
    </pre>
  );
}
