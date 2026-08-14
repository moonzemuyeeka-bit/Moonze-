"use client";

import * as React from "react";
import { useActionState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Hammer,
  Home,
  Landmark,
  PaintRoller,
  Wallet,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldRow } from "@/components/ui/field";
import { Input, NativeSelect, Textarea } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { Progress } from "@/components/ui/controls";
import { FormMessage } from "@/components/forms/form-message";
import { SubmitButton } from "@/components/forms/submit-button";
import { LocationSelect } from "@/components/forms/location-select";
import {
  CONSTRUCTION_STAGE_LABELS,
  CONSTRUCTION_STAGES,
  CONSTRUCTION_TYPE_LABELS,
  CONSTRUCTION_TYPES,
  PROPERTY_TYPE_LABELS,
} from "@/lib/labels";
import { formatZmw, parseKwachaInput } from "@/lib/money";
import { cn } from "@/lib/utils";
import { completeOnboardingAction } from "@/server/projects/actions";
import type { ProvinceOption } from "@/server/reference/queries";
import type { ConstructionStage, PropertyType } from "@prisma/client";

/**
 * Onboarding wizard.
 *
 * Four questions — what, where, how much, how far along — and the customer has a
 * project, a budget broken into 16 categories and a working dashboard. It is one
 * form submitted once at the end: a customer who abandons half way leaves no
 * orphaned project behind, and the browser back button behaves.
 *
 * Every step validates locally before advancing so mistakes surface next to the
 * field, but the server re-validates the whole payload regardless.
 */

const PROPERTY_CHOICES: Array<{
  value: PropertyType;
  icon: React.ComponentType<{ className?: string }>;
  blurb: string;
}> = [
  { value: "HOUSE", icon: Home, blurb: "A standalone home on your own plot." },
  { value: "RENOVATION", icon: PaintRoller, blurb: "Upgrading or repairing an existing building." },
  { value: "APARTMENT", icon: Building2, blurb: "Flats or a multi-unit residential block." },
  { value: "COMMERCIAL", icon: Landmark, blurb: "Shops, offices, a lodge or a warehouse." },
  { value: "BOUNDARY_WALL", icon: Hammer, blurb: "Wall, gate, guard house or paving only." },
  { value: "OTHER", icon: Wallet, blurb: "Something else — you can describe it later." },
];

const BUDGET_PRESETS = [150_000, 350_000, 600_000, 1_200_000];

const STEPS = [
  { id: 1, title: "What are you building?", hint: "This shapes your budget breakdown." },
  { id: 2, title: "Where is the site?", hint: "We use this to find nearby suppliers." },
  { id: 3, title: "What is your budget?", hint: "An estimate is fine — you can change it." },
  { id: 4, title: "How far along are you?", hint: "So your dashboard starts in the right place." },
] as const;

export function OnboardingWizard({
  provinces,
  customerName,
}: {
  provinces: ProvinceOption[];
  customerName: string;
}) {
  const [state, formAction] = useActionState(completeOnboardingAction, null);
  const [step, setStep] = React.useState(1);
  const [localErrors, setLocalErrors] = React.useState<Record<string, string>>({});

  const [propertyType, setPropertyType] = React.useState<PropertyType>("HOUSE");
  const [constructionType, setConstructionType] = React.useState("NEW_BUILD");
  const [projectName, setProjectName] = React.useState("");
  const [provinceId, setProvinceId] = React.useState("");
  const [districtId, setDistrictId] = React.useState("");
  const [locationDetail, setLocationDetail] = React.useState("");
  const [bedrooms, setBedrooms] = React.useState("");
  const [sizeSqm, setSizeSqm] = React.useState("");
  const [budget, setBudget] = React.useState("");
  const [stage, setStage] = React.useState<ConstructionStage>("PLANNING");
  const [targetDate, setTargetDate] = React.useState("");
  const [description, setDescription] = React.useState("");

  const budgetMinor = parseKwachaInput(budget);

  function validateStep(current: number): boolean {
    const errors: Record<string, string> = {};

    if (current === 1) {
      if (projectName.trim().length === 0) {
        errors.projectName = "Give this project a name you will recognise.";
      }
    }
    if (current === 2 && provinceId === "") {
      errors.provinceId = "Choose the province where you are building.";
    }
    if (current === 3) {
      if (budgetMinor === null) errors.estimatedBudget = "Enter a budget, for example 600000.";
      else if (budgetMinor < 100) errors.estimatedBudget = "Enter your total budget in Kwacha.";
    }

    setLocalErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) return;
    setStep((current) => Math.min(STEPS.length, current + 1));
  }

  function goBack() {
    setLocalErrors({});
    setStep((current) => Math.max(1, current - 1));
  }

  const suggestedName = React.useMemo(() => {
    const label = PROPERTY_TYPE_LABELS[propertyType];
    const province = provinces.find((candidate) => candidate.id === provinceId);
    return province ? `${label} — ${province.name}` : label;
  }, [propertyType, provinceId, provinces]);

  const currentStep = STEPS[step - 1] ?? STEPS[0];

  return (
    <div className="mx-auto w-full max-w-2xl">
      <div className="mb-6">
        <p className="text-sm font-medium text-brand-700">
          Welcome, {customerName.split(" ")[0]}
        </p>
        <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">
          Let&rsquo;s set up your first project
        </h1>
        <p className="mt-2 text-sm text-foreground-muted">
          Four quick questions. You will land on a dashboard that tracks your budget, orders and
          deliveries in one place.
        </p>
      </div>

      <div className="mb-5">
        <Progress
          value={(step / STEPS.length) * 100}
          label={`Step ${step} of ${STEPS.length}: ${currentStep.title}`}
        />
        <p className="mt-2 text-xs text-foreground-subtle">
          Step {step} of {STEPS.length} · {currentStep.hint}
        </p>
      </div>

      <form action={formAction} noValidate>
        {/* Every answer travels with the final submit, whichever step it was given on. */}
        <input type="hidden" name="propertyType" value={propertyType} />
        <input type="hidden" name="constructionType" value={constructionType} />
        <input type="hidden" name="projectName" value={projectName || suggestedName} />
        <input type="hidden" name="provinceId" value={provinceId} />
        <input type="hidden" name="districtId" value={districtId} />
        <input type="hidden" name="locationDetail" value={locationDetail} />
        <input type="hidden" name="bedrooms" value={bedrooms} />
        <input type="hidden" name="approximateSizeSqm" value={sizeSqm} />
        <input type="hidden" name="estimatedBudget" value={budget} />
        <input type="hidden" name="stage" value={stage} />
        <input type="hidden" name="targetCompletionDate" value={targetDate} />
        <input type="hidden" name="description" value={description} />

        <Card>
          <CardContent className="space-y-5 pt-6">
            {step === 1 ? (
              <fieldset className="space-y-4">
                <legend className="text-base font-semibold">{currentStep.title}</legend>

                <div
                  role="radiogroup"
                  aria-label="Type of build"
                  className="grid gap-2.5 sm:grid-cols-2"
                >
                  {PROPERTY_CHOICES.map((choice) => {
                    const selected = propertyType === choice.value;
                    return (
                      <button
                        key={choice.value}
                        type="button"
                        role="radio"
                        aria-checked={selected}
                        onClick={() => setPropertyType(choice.value)}
                        className={cn(
                          "flex items-start gap-3 rounded-lg border p-3 text-left transition-colors",
                          selected
                            ? "border-brand-600 bg-brand-50 ring-1 ring-brand-600"
                            : "border-border bg-surface hover:border-brand-300 hover:bg-brand-50/40",
                        )}
                      >
                        <choice.icon
                          className={cn(
                            "mt-0.5 size-5 shrink-0",
                            selected ? "text-brand-700" : "text-ink-400",
                          )}
                        />
                        <span className="min-w-0">
                          <span className="block text-sm font-semibold">
                            {PROPERTY_TYPE_LABELS[choice.value]}
                          </span>
                          <span className="mt-0.5 block text-xs text-foreground-muted">
                            {choice.blurb}
                          </span>
                        </span>
                      </button>
                    );
                  })}
                </div>

                <FieldRow className="sm:grid-cols-2">
                  <Field
                    name="constructionTypeChoice"
                    label="Type of work"
                    hint="New build, renovation, extension or finishing only."
                  >
                    {(control) => (
                      <NativeSelect
                        {...control}
                        value={constructionType}
                        onChange={(event) => setConstructionType(event.target.value)}
                      >
                        {CONSTRUCTION_TYPES.map((type) => (
                          <option key={type} value={type}>
                            {CONSTRUCTION_TYPE_LABELS[type]}
                          </option>
                        ))}
                      </NativeSelect>
                    )}
                  </Field>

                  <Field
                    name="projectNameInput"
                    label="Project name"
                    required
                    error={localErrors.projectName}
                    hint={`For example "${suggestedName}"`}
                  >
                    {(control) => (
                      <Input
                        {...control}
                        value={projectName}
                        onChange={(event) => setProjectName(event.target.value)}
                        placeholder={suggestedName}
                        autoComplete="off"
                      />
                    )}
                  </Field>
                </FieldRow>
              </fieldset>
            ) : null}

            {step === 2 ? (
              <fieldset className="space-y-4">
                <legend className="text-base font-semibold">{currentStep.title}</legend>

                <LocationSelect
                  provinces={provinces}
                  provinceId={provinceId}
                  districtId={districtId}
                  onProvinceChange={setProvinceId}
                  onDistrictChange={setDistrictId}
                  provinceError={localErrors.provinceId}
                  emitFields={false}
                />

                <Field
                  name="locationDetailInput"
                  label="Area or landmark"
                  hint="Optional. Helps suppliers quote delivery accurately."
                >
                  {(control) => (
                    <Input
                      {...control}
                      value={locationDetail}
                      onChange={(event) => setLocationDetail(event.target.value)}
                      placeholder="Chalala, off Joseph Mwilwa Road"
                    />
                  )}
                </Field>

                <FieldRow className="sm:grid-cols-2">
                  <Field name="bedroomsInput" label="Bedrooms" hint="Optional.">
                    {(control) => (
                      <Input
                        {...control}
                        type="number"
                        min={1}
                        max={40}
                        value={bedrooms}
                        onChange={(event) => setBedrooms(event.target.value)}
                        placeholder="3"
                      />
                    )}
                  </Field>
                  <Field
                    name="sizeInput"
                    label="Approximate floor area"
                    hint="Optional, in square metres."
                  >
                    {(control) => (
                      <Input
                        {...control}
                        type="number"
                        min={1}
                        value={sizeSqm}
                        onChange={(event) => setSizeSqm(event.target.value)}
                        placeholder="165"
                      />
                    )}
                  </Field>
                </FieldRow>
              </fieldset>
            ) : null}

            {step === 3 ? (
              <fieldset className="space-y-4">
                <legend className="text-base font-semibold">{currentStep.title}</legend>

                <Field
                  name="budgetInput"
                  label="Total budget"
                  required
                  error={localErrors.estimatedBudget}
                  hint="In Kwacha. BuildLink splits this across 16 categories you can adjust."
                >
                  {(control) => (
                    <Input
                      {...control}
                      inputMode="decimal"
                      value={budget}
                      onChange={(event) => setBudget(event.target.value)}
                      placeholder="600000"
                    />
                  )}
                </Field>

                <div className="flex flex-wrap gap-2">
                  {BUDGET_PRESETS.map((preset) => (
                    <Button
                      key={preset}
                      type="button"
                      variant={budget === String(preset) ? "secondary" : "outline"}
                      size="sm"
                      onClick={() => setBudget(String(preset))}
                    >
                      {formatZmw(preset * 100, { compactDecimals: true })}
                    </Button>
                  ))}
                </div>

                {budgetMinor !== null && budgetMinor > 0 ? (
                  <Alert tone="info" title="Your starting breakdown">
                    We will pre-fill your {PROPERTY_TYPE_LABELS[propertyType].toLowerCase()} budget of{" "}
                    <strong>{formatZmw(budgetMinor)}</strong> across foundation, walling, roofing,
                    plumbing, electrical, finishes, labour and more. These are planning heuristics for
                    a typical Zambian build, not a costed estimate — every figure stays editable.
                  </Alert>
                ) : null}
              </fieldset>
            ) : null}

            {step === 4 ? (
              <fieldset className="space-y-4">
                <legend className="text-base font-semibold">{currentStep.title}</legend>

                <Field
                  name="stageInput"
                  label="Current stage"
                  hint="Pick the stage you are working on now."
                >
                  {(control) => (
                    <NativeSelect
                      {...control}
                      value={stage}
                      onChange={(event) => setStage(event.target.value as ConstructionStage)}
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
                  name="targetDateInput"
                  label="Target completion"
                  hint="Optional. Used for reminders and progress pacing."
                >
                  {(control) => (
                    <Input
                      {...control}
                      type="date"
                      value={targetDate}
                      onChange={(event) => setTargetDate(event.target.value)}
                    />
                  )}
                </Field>

                <Field name="notesInput" label="Anything else?" hint="Optional. Only you see this.">
                  {(control) => (
                    <Textarea
                      {...control}
                      rows={3}
                      value={description}
                      onChange={(event) => setDescription(event.target.value)}
                      placeholder="Foundation done, walling to wall plate next. Aiming to roof before the rains."
                    />
                  )}
                </Field>

                <div className="rounded-lg border border-border bg-surface-muted p-3.5">
                  <h3 className="flex items-center gap-2 text-sm font-semibold">
                    <CheckCircle2 className="size-4 text-brand-700" />
                    Ready to create
                  </h3>
                  <dl className="mt-2 grid gap-1.5 text-sm sm:grid-cols-2">
                    <SummaryRow label="Project" value={projectName || suggestedName} />
                    <SummaryRow label="Type" value={PROPERTY_TYPE_LABELS[propertyType]} />
                    <SummaryRow
                      label="Location"
                      value={
                        provinces.find((province) => province.id === provinceId)?.name ??
                        "Not set"
                      }
                    />
                    <SummaryRow
                      label="Budget"
                      value={budgetMinor !== null ? formatZmw(budgetMinor) : "Not set"}
                    />
                    <SummaryRow label="Stage" value={CONSTRUCTION_STAGE_LABELS[stage]} />
                  </dl>
                </div>
              </fieldset>
            ) : null}

            <FormMessage state={state} />
          </CardContent>
        </Card>

        <div className="mt-5 flex items-center justify-between gap-3">
          {step > 1 ? (
            <Button type="button" variant="ghost" onClick={goBack}>
              <ArrowLeft />
              Back
            </Button>
          ) : (
            <span />
          )}

          {step < STEPS.length ? (
            <Button type="button" onClick={goNext}>
              Continue
              <ArrowRight />
            </Button>
          ) : (
            <SubmitButton size="lg">Create my project</SubmitButton>
          )}
        </div>
      </form>
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex min-w-0 justify-between gap-2 sm:block">
      <dt className="text-xs uppercase tracking-wide text-foreground-subtle">{label}</dt>
      <dd className="truncate font-medium">{value}</dd>
    </div>
  );
}
