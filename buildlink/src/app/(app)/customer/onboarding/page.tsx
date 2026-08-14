import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { db } from "@/lib/db";
import { requirePagePermission } from "@/lib/auth/guards";
import { getProvinces } from "@/server/reference/queries";
import { OnboardingWizard } from "./onboarding-wizard";

export const metadata: Metadata = {
  title: "Set up your project",
  description: "Tell BuildLink what you are building so your dashboard, budget and supplier suggestions start in the right place.",
};

/**
 * A customer who already has a project does not need the wizard: send them to
 * the dashboard rather than letting them create a duplicate by accident.
 */
export default async function OnboardingPage() {
  const user = await requirePagePermission("project:manage", "/customer/onboarding");

  const existingProjects = await db.project.count({
    where: { customerId: user.id, deletedAt: null },
  });
  if (existingProjects > 0) redirect("/customer/dashboard");

  const provinces = await getProvinces();

  return <OnboardingWizard provinces={provinces} customerName={user.name} />;
}
