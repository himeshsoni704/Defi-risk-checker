import type { Metadata } from "next";
import Link from "next/link";
import "./globals.css";

export const metadata: Metadata = {
  title: "DeFi Risk Checker",
  description:
    "Quantum ML risk scoring with explainable AI, an independent explanation audit, and blockchain proof-of-decision.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <nav className="nav">
          <div className="container nav-inner">
            <Link href="/" className="brand">
              <span className="brand-dot" />
              DeFi Risk Checker
            </Link>
            <div className="nav-links">
              <Link href="/">Home</Link>
              <Link href="/score">Score a wallet</Link>
              <Link href="/how-it-works">How it works</Link>
            </div>
          </div>
        </nav>
        {children}
        <footer className="footer">
          <div className="container">
            Quantum ML · Explainable AI · Explanation Audit · Blockchain
            Proof-of-Decision. Demo runs on a simulated provider.
          </div>
        </footer>
      </body>
    </html>
  );
}
