import type { Metadata, Viewport } from "next";
import { Bricolage_Grotesque, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { AnalysisProvider } from "@/lib/analysis-store";
import { ToastProvider } from "@/components/ui/Toast";
import { TourProvider } from "@/components/tour/TourProvider";
import AppShell from "@/components/shell/AppShell";

const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-bricolage",
  display: "swap",
});

const body = Geist({
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  variable: "--font-geist",
  display: "swap",
});

const mono = Geist_Mono({
  subsets: ["latin"],
  weight: ["400", "500"],
  variable: "--font-geist-mono",
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
  themeColor: "#06070a",
  colorScheme: "dark",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${body.variable} ${mono.variable}`}>
      <body>
        <ToastProvider>
          <AnalysisProvider>
            <TourProvider>
              <AppShell>{children}</AppShell>
            </TourProvider>
          </AnalysisProvider>
        </ToastProvider>
      </body>
    </html>
  );
}
