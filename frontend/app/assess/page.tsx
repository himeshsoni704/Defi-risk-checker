import type { Metadata } from "next";
import AssessView from "./AssessView";

export const metadata: Metadata = { title: "Risk assessment" };

export default async function AssessPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  const wallet = typeof sp.wallet === "string" ? sp.wallet : undefined;
  return <AssessView urlWallet={wallet} autoRun={sp.run === "1"} />;
}
