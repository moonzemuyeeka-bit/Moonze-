"use client";

import * as React from "react";
import { useActionState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { LocationSelect } from "@/components/forms/location-select";
import {
  CONSTRUCTION_STAGE_LABELS,
  CONSTRUCTION_STAGES,
  CONSTRUCTION_TYPE_LABELS,
  CONSTRUCTION_TYPES,
  PROJECT_STATUS_LABELS,
  PROJECT_STATUSES,
  PROPERTY_TYPE_LABELS,
  PROPERTY_TYPES,
  STAGE_PROGRESS_PERCENT,
} from "@/lib/labels";
import { toKwacha } from "@/lib/money";
import { createProjectAction, updateProjectAction } from "@/server/projects/actions";
import type { ProvinceOption } from "@/server/reference/queries";
import type { ConstructionStage } from "@prisma/client";

/**
 * Project create / edit form.
 *
 * One component serves both so the two screens cannot drift apart. Moving the
 * stage suggests a matching progress figure — the typical share of a build
 * complete at that stage — which the customer can override, because only they
 * know whether their roof went on quickly or slowly.
 */
export type ProjectFormValues = {
  id?: string;
  name: string;
  propertyType: string;
  constructionType: string;
  provinceId: string | null;
  districtId: string | null;
  locationDetail: string | null;
  bedrooms: number | null;
  approximateSizeSqm: number | null;
  stage: ConstructionStage;
  status: string;
  estimatedBudgetMinor: number;
  description: string | null;
  startDate: Date | null;
  targetCompletionDate: Date | null;
  progressPercent: number;
};

function dateValue(date: Date | null): string {
  return date ? date.toISOString().slice(0, 10) : "";
}

export function ProjectForm({
  provinces,
  values,
  mode,
}: {
  provinces: ProvinceOption[];
  values: ProjectFormValues;
  mode: "create" | "edit";
}) {
  const action = mode === "create" ? createProjectAction : updateProjectAction;
  const [state, formAction] = useActionState(action, null);

  const [stage, setStage] = React.useState<ConstructionStage>(values.stage);
  const [progress, setProgress] = React.useState(String(values.progressPercent));
  const [progressTouched, setProgressTouched] = React.useState(false);

  function handleStageChange(next: ConstructionStage) {
    setStage(next);
    if (!progressTouched) setProgress(String(STAGE_PROGRESS_PERCENT[next]));
  }

  return (
    <form action={formAction} className="space-y-5" noValidate>
      {values.id ? <input type="hidden" name="projectId" value={values.id} /> : null}

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            What you are building
          </CardTitle>
          <CardDescription>
            The type of build determines the suggested budget breakdown.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="name"
            label="Project name"
            required
            error={fieldError(state, "name")}
            hint="Something you will recognise on your dashboard."
          >
            {(control) => (
              <Input {...control} defaultValue={values.name} placeholder="Family house — Chalala" />
            )}
          </Field>

          <FieldRow className="sm:grid-cols-2">
            <Field
              name="propertyType"
              label="Property type"
              required
              error={fieldError(state, "propertyType")}
            >
              {(control) => (
                <NativeSelect {...control} defaultValue={values.propertyType}>
                  {PROPERTY_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {PROPERTY_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field
              name="constructionType"
              label="Type of work"
              required
              error={fieldError(state, "constructionType")}
            >
              {(control) => (
                <NativeSelect {...control} defaultValue={values.constructionType}>
                  {CONSTRUCTION_TYPES.map((type) => (
                    <option key={type} value={type}>
                      {CONSTRUCTION_TYPE_LABELS[type]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </FieldRow>

          <FieldRow className="sm:grid-cols-2">
            <Field
              name="bedrooms"
              label="Bedrooms"
              hint="Optional."
              error={fieldError(state, "bedrooms")}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  max={40}
                  defaultValue={values.bedrooms ?? ""}
                />
              )}
            </Field>
            <Field
              name="approximateSizeSqm"
              label="Floor area (m²)"
              hint="Optional. Used by the material estimator."
              error={fieldError(state, "approximateSizeSqm")}
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={1}
                  defaultValue={values.approximateSizeSqm ?? ""}
                />
              )}
            </Field>
          </FieldRow>

          <Field
            name="description"
            label="Notes"
            hint="Optional. Only you can see this."
            error={fieldError(state, "description")}
          >
            {(control) => (
              <Textarea
                {...control}
                rows={3}
                defaultValue={values.description ?? ""}
                placeholder="Three-bedroom house on a 20 × 30 m plot. Foundation complete."
              />
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Where the site is
          </CardTitle>
          <CardDescription>
            Suppliers near your district appear first in marketplace results.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <LocationSelect
            provinces={provinces}
            defaultProvinceId={values.provinceId}
            defaultDistrictId={values.districtId}
            provinceError={fieldError(state, "provinceId")}
            districtError={fieldError(state, "districtId")}
          />
          <Field
            name="locationDetail"
            label="Area or landmark"
            hint="Optional. Helps suppliers quote delivery."
            error={fieldError(state, "locationDetail")}
          >
            {(control) => (
              <Input
                {...control}
                defaultValue={values.locationDetail ?? ""}
                placeholder="Chalala, off Joseph Mwilwa Road"
              />
            )}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle as="h2" className="text-base">
            Budget and progress
          </CardTitle>
          <CardDescription>
            Everything here is editable at any time as your build changes.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field
            name="estimatedBudget"
            label="Total budget (ZMW)"
            required
            error={fieldError(state, "estimatedBudget")}
            hint="Your overall figure. The category breakdown lives on the budget screen."
          >
            {(control) => (
              <Input
                {...control}
                inputMode="decimal"
                defaultValue={
                  values.estimatedBudgetMinor > 0 ? String(toKwacha(values.estimatedBudgetMinor)) : ""
                }
                placeholder="600000"
              />
            )}
          </Field>

          <FieldRow className="sm:grid-cols-3">
            <Field name="stage" label="Current stage" required error={fieldError(state, "stage")}>
              {(control) => (
                <NativeSelect
                  {...control}
                  value={stage}
                  onChange={(event) => handleStageChange(event.target.value as ConstructionStage)}
                >
                  {CONSTRUCTION_STAGES.map((value) => (
                    <option key={value} value={value}>
                      {CONSTRUCTION_STAGE_LABELS[value]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>

            <Field
              name="progressPercent"
              label="Progress (%)"
              required
              error={fieldError(state, "progressPercent")}
              hint="Suggested from the stage."
            >
              {(control) => (
                <Input
                  {...control}
                  type="number"
                  min={0}
                  max={100}
                  value={progress}
                  onChange={(event) => {
                    setProgressTouched(true);
                    setProgress(event.target.value);
                  }}
                />
              )}
            </Field>

            <Field name="status" label="Status" required error={fieldError(state, "status")}>
              {(control) => (
                <NativeSelect {...control} defaultValue={values.status}>
                  {PROJECT_STATUSES.map((value) => (
                    <option key={value} value={value}>
                      {PROJECT_STATUS_LABELS[value]}
                    </option>
                  ))}
                </NativeSelect>
              )}
            </Field>
          </FieldRow>

          <FieldRow className="sm:grid-cols-2">
            <Field name="startDate" label="Start date" hint="Optional.">
              {(control) => (
                <Input {...control} type="date" defaultValue={dateValue(values.startDate)} />
              )}
            </Field>
            <Field name="targetCompletionDate" label="Target completion" hint="Optional.">
              {(control) => (
                <Input
                  {...control}
                  type="date"
                  defaultValue={dateValue(values.targetCompletionDate)}
                />
              )}
            </Field>
          </FieldRow>
        </CardContent>
      </Card>

      <FormMessage state={state} successMessage="Project saved." />

      <div className="flex flex-wrap items-center gap-3">
        <SubmitButton size="lg">
          {mode === "create" ? "Create project" : "Save changes"}
        </SubmitButton>
        <Button asChild variant="ghost">
          <Link href={values.id ? `/customer/projects/${values.id}` : "/customer/projects"}>
            Cancel
          </Link>
        </Button>
      </div>
    </form>
  );
}
