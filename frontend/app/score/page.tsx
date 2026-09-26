import { redirect } from "next/navigation";

// The scoring page moved to /assess.
export default function LegacyScoreRoute() {
  redirect("/assess");
}
