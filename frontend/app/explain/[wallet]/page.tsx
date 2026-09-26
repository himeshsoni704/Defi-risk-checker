import { redirect } from "next/navigation";

// Older links used /explain/<wallet>; the page now reads the wallet from ?wallet=.
export default async function LegacyExplainRoute({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  redirect(`/explain?wallet=${encodeURIComponent(decodeURIComponent(wallet))}`);
}
