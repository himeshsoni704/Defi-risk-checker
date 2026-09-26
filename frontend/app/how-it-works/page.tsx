import { redirect } from "next/navigation";

// The pipeline walkthrough now lives on the dashboard and in the guided tour.
export default function LegacyHowItWorksRoute() {
  redirect("/");
}
