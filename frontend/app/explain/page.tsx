import type { Metadata } from "next";
import ExplainView from "./ExplainView";

export const metadata: Metadata = { title: "Explanation" };

export default async function ExplainPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <ExplainView urlWallet={typeof sp.wallet === "string" ? sp.wallet : undefined} />;
}
