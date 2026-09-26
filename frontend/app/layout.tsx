import type { Metadata, Viewport } from "next";
import { IBM_Plex_Mono, IBM_Plex_Sans, Schibsted_Grotesk } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/lib/analysis-store";
import { TourProvider } from "@/components/tour/TourProvider";
import AppShell from "@/components/shell/AppShell";

const display = Schibsted_Grotesk({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-schibsted",
  display: "swap",
});

const body = IBM_Plex_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-plex-sans",
  display: "swap",
});

const mono = IBM_Plex_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-plex-mono",
  display: "swap",
});

export const metadata: Metadata = {
  title: {
    default: "DeFi Risk Checker",
    template: "%s · DeFi Risk Checker",
  },
  description:
    "Wallet risk scoring with a quantum support vector classifier, SHAP explanations, an independent explanation audit, and on-chain proof of every decision.",
};

export const viewport: Viewport = {
  themeColor: "#0a0c0f",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <AnalysisProvider>
          <TourProvider>
            <AppShell>{children}</AppShell>
          </TourProvider>
        </AnalysisProvider>
      </body>
    </html>
  );
}
