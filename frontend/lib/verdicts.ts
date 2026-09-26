export type Tone = "good" | "bad" | "warn" | "neutral" | "iris";

export function isDenied(decision: string | null | undefined) {
  return (decision ?? "").toUpperCase().startsWith("DEN");
}

export function decisionTone(decision: string | null | undefined): Tone {
  if (!decision) return "neutral";
  const d = decision.toUpperCase();
  if (d.startsWith("APPROV")) return "good";
  if (d.startsWith("DEN")) return "bad";
  return "neutral";
}

export function dimensionTone(verdict: string | null | undefined): Tone {
  switch ((verdict ?? "").toUpperCase()) {
    case "HIGH":
      return "good";
    case "MEDIUM":
      return "warn";
    case "LOW":
      return "bad";
    default:
      return "neutral";
  }
}

export function overallTone(verdict: string | null | undefined): Tone {
  switch ((verdict ?? "").toUpperCase()) {
    case "SUPPORTED":
      return "good";
    case "SUPPORTED WITH CAUTION":
      return "warn";
    case "QUESTIONABLE":
      return "bad";
    default:
      return "neutral";
  }
}

export function toneVar(tone: Tone): string {
  switch (tone) {
    case "good":
      return "var(--good)";
    case "bad":
      return "var(--bad)";
    case "warn":
      return "var(--warn)";
    case "iris":
      return "var(--iris-2)";
    default:
      return "var(--ink-3)";
  }
}

export function toneIcon(tone: Tone): string {
  return tone === "good" ? "check" : tone === "bad" ? "x" : tone === "warn" ? "alert" : "info";
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}

export function sentenceCase(s: string): string {
  const l = s.toLowerCase();
  return l.charAt(0).toUpperCase() + l.slice(1);
}
