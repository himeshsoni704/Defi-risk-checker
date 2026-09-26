import type { Metadata } from "next";
import VerifyView from "./VerifyView";

export const metadata: Metadata = { title: "Verification" };

export default async function VerifyPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const sp = await searchParams;
  return <VerifyView urlWallet={typeof sp.wallet === "string" ? sp.wallet : undefined} />;
}
