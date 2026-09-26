import { redirect } from "next/navigation";

// Older links used /verify/<wallet>; the page now reads the wallet from ?wallet=.
export default async function LegacyVerifyRoute({ params }: { params: Promise<{ wallet: string }> }) {
  const { wallet } = await params;
  redirect(`/verify?wallet=${encodeURIComponent(decodeURIComponent(wallet))}`);
}
