export type Tone = "pos" | "neg" | "warn" | "neutral" | "accent";

export function decisionTone(decision: string | null | undefined): Tone {
  if (!decision) return "neutral";
  const d = decision.toUpperCase();
  if (d.startsWith("APPROV")) return "pos";
  if (d.startsWith("DEN")) return "neg";
  return "neutral";
}

export function dimensionTone(verdict: string | null | undefined): Tone {
  switch ((verdict ?? "").toUpperCase()) {
    case "HIGH":
      return "pos";
    case "MEDIUM":
      return "warn";
    case "LOW":
      return "neg";
    default:
      return "neutral";
  }
}

export function overallTone(verdict: string | null | undefined): Tone {
  switch ((verdict ?? "").toUpperCase()) {
    case "SUPPORTED":
      return "pos";
    case "SUPPORTED WITH CAUTION":
      return "warn";
    case "QUESTIONABLE":
      return "neg";
    default:
      return "neutral";
  }
}

export function toneVar(tone: Tone): string {
  switch (tone) {
    case "pos":
      return "var(--pos)";
    case "neg":
      return "var(--neg)";
    case "warn":
      return "var(--warn)";
    case "accent":
      return "var(--accent)";
    default:
      return "var(--text-3)";
  }
}

export function titleCase(s: string): string {
  return s.toLowerCase().replace(/(^|\s)\S/g, (m) => m.toUpperCase());
}
