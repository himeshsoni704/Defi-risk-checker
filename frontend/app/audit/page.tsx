import type { Metadata } from "next";
import AuditView from "./AuditView";

export const metadata: Metadata = { title: "XAI audit" };

export default async function AuditPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <AuditView urlWallet={typeof sp.wallet === "string" ? sp.wallet : undefined} />;
}
