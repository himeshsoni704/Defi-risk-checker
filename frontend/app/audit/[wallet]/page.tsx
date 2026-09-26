import { redirect } from "next/navigation";

// Older links used /audit/<wallet>; the page now reads the wallet from ?wallet=.
export default async function LegacyAuditRoute({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  redirect(`/audit?wallet=${encodeURIComponent(decodeURIComponent(wallet))}`);
}
