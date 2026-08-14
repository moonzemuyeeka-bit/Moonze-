import type { Metadata } from "next";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { getProvinces } from "@/server/reference/queries";
import { ProjectForm } from "../project-form";

export const metadata: Metadata = {
  title: "New project",
  description: "Add another build to your BuildLink account.",
};

export default async function NewProjectPage() {
  await requirePagePermission("project:manage", "/customer/projects/new");
  const provinces = await getProvinces();

  return (
    <div className="max-w-3xl">
      <PageHeader
        title="New project"
        description="BuildLink creates a budget with the standard 16 categories, pre-split for this type of build. You can change every figure afterwards."
        breadcrumbs={[
          { label: "Dashboard", href: "/customer/dashboard" },
          { label: "Projects", href: "/customer/projects" },
          { label: "New" },
        ]}
      />

      <ProjectForm
        mode="create"
        provinces={provinces}
        values={{
          name: "",
          propertyType: "HOUSE",
          constructionType: "NEW_BUILD",
          provinceId: null,
          districtId: null,
          locationDetail: null,
          bedrooms: null,
          approximateSizeSqm: null,
          stage: "PLANNING",
          status: "PLANNING",
          estimatedBudgetMinor: 0,
          description: null,
          startDate: null,
          targetCompletionDate: null,
          progressPercent: 2,
        }}
      />
    </div>
  );
}
