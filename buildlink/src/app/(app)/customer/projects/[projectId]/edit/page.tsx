import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { PageHeader } from "@/components/ui/page-header";
import { requirePagePermission } from "@/lib/auth/guards";
import { NotFoundError } from "@/lib/errors";
import { getProject } from "@/server/projects/queries";
import { getProvinces } from "@/server/reference/queries";
import { ProjectForm } from "../../project-form";

export const metadata: Metadata = { title: "Edit project" };

export default async function EditProjectPage({
  params,
}: {
  params: Promise<{ projectId: string }>;
}) {
  const { projectId } = await params;
  const user = await requirePagePermission(
    "project:manage",
    `/customer/projects/${projectId}/edit`,
  );

  try {
    const [project, provinces] = await Promise.all([getProject(projectId, user), getProvinces()]);

    return (
      <div className="max-w-3xl">
        <PageHeader
          title="Edit project"
          description="Changing the total budget leaves your category amounts as they are — adjust those on the budget screen."
          breadcrumbs={[
            { label: "Projects", href: "/customer/projects" },
            { label: project.name, href: `/customer/projects/${project.id}` },
            { label: "Edit" },
          ]}
        />

        <ProjectForm
          mode="edit"
          provinces={provinces}
          values={{
            id: project.id,
            name: project.name,
            propertyType: project.propertyType,
            constructionType: project.constructionType,
            provinceId: project.provinceId,
            districtId: project.districtId,
            locationDetail: project.locationDetail,
            bedrooms: project.bedrooms,
            approximateSizeSqm: project.approximateSizeSqm,
            stage: project.stage,
            status: project.status,
            estimatedBudgetMinor: project.estimatedBudgetMinor,
            description: project.description,
            startDate: project.startDate,
            targetCompletionDate: project.targetCompletionDate,
            progressPercent: project.progressPercent,
          }}
        />
      </div>
    );
  } catch (error) {
    if (error instanceof NotFoundError) notFound();
    throw error;
  }
}
