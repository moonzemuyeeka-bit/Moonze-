import type { Metadata } from "next";
import Link from "next/link";
import { FolderKanban, MapPin, Plus } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/controls";
import { EmptyState } from "@/components/ui/feedback";
import { formatDate } from "@/components/ui/timeline";
import { requirePagePermission } from "@/lib/auth/guards";
import { listProjects, type ProjectSummary } from "@/server/projects/queries";
import { formatZmwShort } from "@/lib/money";
import {
  CONSTRUCTION_STAGE_LABELS,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUS_TONES,
} from "@/lib/labels";

export const metadata: Metadata = {
  title: "My projects",
  description: "Every build you are running, with budget and progress.",
};

/**
 * Project list.
 *
 * A customer usually has one project, occasionally three or four (a house, a
 * boundary wall, a rental block). Cards rather than a table, because the figures
 * that matter — budget, spent, progress — need room to be legible on a phone.
 */
export default async function ProjectsPage() {
  const user = await requirePagePermission("project:manage", "/customer/projects");
  const projects = await listProjects(user);

  return (
    <div>
      <PageHeader
        title="My projects"
        description="Each project keeps its own budget, orders and agreements."
        breadcrumbs={[{ label: "Dashboard", href: "/customer/dashboard" }, { label: "Projects" }]}
        actions={
          <Button asChild>
            <Link href="/customer/projects/new">
              <Plus />
              New project
            </Link>
          </Button>
        }
      />

      {projects.length === 0 ? (
        <EmptyState
          icon={FolderKanban}
          title="No projects yet"
          description="Set up your first project and BuildLink will track your budget, spending and orders against it."
          action={
            <Button asChild>
              <Link href="/customer/onboarding">Set up my build</Link>
            </Button>
          }
          secondaryAction={
            <Button asChild variant="outline">
              <Link href="/marketplace">Browse materials first</Link>
            </Button>
          }
        />
      ) : (
        <ul className="grid gap-4 lg:grid-cols-2">
          {projects.map((project) => (
            <li key={project.id}>
              <ProjectCard project={project} />
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function ProjectCard({ project }: { project: ProjectSummary }) {
  return (
    <Card className="h-full">
      <CardContent className="space-y-4 p-5">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <h2 className="truncate text-base font-semibold">
              <Link
                href={`/customer/projects/${project.id}`}
                className="hover:text-brand-700 hover:underline"
              >
                {project.name}
              </Link>
            </h2>
            <p className="mt-0.5 flex items-center gap-1 text-xs text-foreground-muted">
              <MapPin aria-hidden className="size-3.5 shrink-0" />
              <span className="truncate">
                {project.districtName ? `${project.districtName}, ` : ""}
                {project.provinceName}
              </span>
            </p>
          </div>
          <Badge tone={PROJECT_STATUS_TONES[project.status]}>
            {PROJECT_STATUS_LABELS[project.status]}
          </Badge>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-xs">
            <span className="font-medium text-foreground">
              {CONSTRUCTION_STAGE_LABELS[project.stage]}
            </span>
            <span className="tabular-nums text-foreground-muted">{project.progressPercent}%</span>
          </div>
          <Progress
            value={project.progressPercent}
            label={`${project.name}: ${project.progressPercent}% complete`}
          />
        </div>

        <dl className="grid grid-cols-3 gap-2 border-t border-border pt-3 text-sm">
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground-subtle">Budget</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {formatZmwShort(project.estimatedBudgetMinor)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground-subtle">Spent</dt>
            <dd className="mt-0.5 font-semibold tabular-nums">
              {formatZmwShort(project.spentMinor)}
            </dd>
          </div>
          <div>
            <dt className="text-xs uppercase tracking-wide text-foreground-subtle">Left</dt>
            <dd
              className={
                project.isOverBudget
                  ? "mt-0.5 font-semibold tabular-nums text-danger-700"
                  : "mt-0.5 font-semibold tabular-nums text-brand-700"
              }
            >
              {formatZmwShort(project.remainingMinor)}
            </dd>
          </div>
        </dl>

        <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-foreground-muted">
          <span>
            {project.openOrderCount > 0
              ? `${project.openOrderCount} open ${project.openOrderCount === 1 ? "order" : "orders"}`
              : "No open orders"}
            {project.targetCompletionDate
              ? ` · target ${formatDate(project.targetCompletionDate)}`
              : ""}
          </span>
          <Button asChild size="sm" variant="ghost">
            <Link href={`/customer/projects/${project.id}/budget`}>Budget</Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
