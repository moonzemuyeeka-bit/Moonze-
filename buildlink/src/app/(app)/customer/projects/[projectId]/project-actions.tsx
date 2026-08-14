"use client";

import * as React from "react";
import { useActionState } from "react";
import { ArrowRight, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Field } from "@/components/ui/field";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { CONSTRUCTION_STAGE_LABELS, CONSTRUCTION_STAGES, STAGE_PROGRESS_PERCENT } from "@/lib/labels";
import { advanceProjectStageAction, deleteProjectAction } from "@/server/projects/actions";
import type { ConstructionStage } from "@prisma/client";

/**
 * Stage advance.
 *
 * The common case is "we finished the roof" — one dropdown and a button, with
 * the progress figure suggested from the stage and still editable, because a
 * customer knows better than a lookup table how far along their build is.
 */
export function AdvanceStageForm({
  projectId,
  stage,
  progressPercent,
}: {
  projectId: string;
  stage: ConstructionStage;
  progressPercent: number;
}) {
  const [state, formAction] = useActionState(advanceProjectStageAction, null);
  const [nextStage, setNextStage] = React.useState<ConstructionStage>(stage);
  const [progress, setProgress] = React.useState(String(progressPercent));
  const [progressTouched, setProgressTouched] = React.useState(false);

  function handleStageChange(value: ConstructionStage) {
    setNextStage(value);
    if (!progressTouched) setProgress(String(STAGE_PROGRESS_PERCENT[value]));
  }

  return (
    <form action={formAction} className="space-y-4" noValidate>
      <input type="hidden" name="projectId" value={projectId} />

      <div className="grid gap-3 sm:grid-cols-2">
        <Field name="stage" label="Stage reached" required error={fieldError(state, "stage")}>
          {(control) => (
            <NativeSelect
              {...control}
              value={nextStage}
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
          hint="Suggested from the stage."
          error={fieldError(state, "progressPercent")}
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
      </div>

      <FormMessage state={state} successMessage="Progress updated." />

      <SubmitButton size="sm" variant="outline">
        Update progress
        <ArrowRight />
      </SubmitButton>
    </form>
  );
}

/**
 * Delete.
 *
 * Typing the project name is deliberate friction: a project carries orders,
 * payments and agreements, and removing it from the dashboard by accident would
 * be alarming. The row is soft-deleted, so support can restore it.
 */
export function DeleteProjectDialog({
  projectId,
  projectName,
}: {
  projectId: string;
  projectName: string;
}) {
  const [state, formAction] = useActionState(deleteProjectAction, null);

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button variant="ghost" size="sm" className="text-danger-700 hover:bg-danger-50">
          <Trash2 />
          Delete project
        </Button>
      </DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Delete “{projectName}”?</DialogTitle>
          <DialogDescription>
            The project disappears from your dashboard and budget. Your orders, payments and
            agreements are kept — they are your record of what you bought and paid.
          </DialogDescription>
        </DialogHeader>

        <form action={formAction} className="space-y-4" noValidate>
          <input type="hidden" name="projectId" value={projectId} />

          <Alert tone="warning" title="This cannot be undone from here">
            Contact support if you need the project restored.
          </Alert>

          <Field
            name="confirmName"
            label="Type the project name to confirm"
            required
            error={fieldError(state, "confirmName")}
          >
            {(control) => <Input {...control} autoComplete="off" placeholder={projectName} />}
          </Field>

          <FormMessage state={state} />

          <DialogFooter>
            <SubmitButton variant="danger">Delete project</SubmitButton>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
