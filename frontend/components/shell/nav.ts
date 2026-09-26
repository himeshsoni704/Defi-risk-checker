export interface NavItem {
  href: string;
  label: string;
  icon: string;
  /** Step number in the analysis flow, when the page is part of it. */
  step?: number;
  flow?: "assess" | "explain" | "audit" | "verify";
  tour: string;
}

export const OVERVIEW: NavItem[] = [{ href: "/", label: "Dashboard", icon: "dashboard", tour: "nav-dashboard" }];

export const FLOW: NavItem[] = [
  { href: "/assess", label: "Risk assessment", icon: "gauge", step: 1, flow: "assess", tour: "nav-assess" },
  { href: "/explain", label: "Explanation", icon: "bars", step: 2, flow: "explain", tour: "nav-explain" },
  { href: "/audit", label: "XAI audit", icon: "shield", step: 3, flow: "audit", tour: "nav-audit" },
  { href: "/verify", label: "Verification", icon: "chain", step: 4, flow: "verify", tour: "nav-verify" },
];

export const REFERENCE: NavItem[] = [{ href: "/models", label: "Model comparison", icon: "compare", tour: "nav-models" }];

export const ALL_NAV = [...OVERVIEW, ...FLOW, ...REFERENCE];

export function withWallet(href: string, wallet: string | null | undefined) {
  return wallet ? `${href}?wallet=${encodeURIComponent(wallet)}` : href;
}
