"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Pencil, Plus, Sparkles, Trash2 } from "lucide-react";
import { Alert } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogClose, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Field, Input, Textarea } from "@/components/ui/field";
import { ApiClientError, apiRequest } from "@/lib/api-client";
import { formatKwacha, toKwacha } from "@/lib/money";
import { formatDuration } from "@/lib/time";

export type AdminServiceView = {
  id: string;
  name: string;
  description: string;
  priceNgwee: number;
  priceFrom: boolean;
  durationMinutes: number;
  active: boolean;
  featured: boolean;
  bookingCount: number;
};

type FormState = {
  name: string;
  description: string;
  priceKwacha: string;
  durationMinutes: string;
  priceFrom: boolean;
  active: boolean;
  featured: boolean;
};

const EMPTY_FORM: FormState = {
  name: "",
  description: "",
  priceKwacha: "280",
  durationMinutes: "120",
  priceFrom: false,
  active: true,
  featured: false,
};

/**
 * Services and prices. Prices live in the database, so a change here is what
 * every future customer sees — historical bookings keep the price they paid.
 */
export function ServiceManager({ services }: { services: AdminServiceView[] }) {
  const router = useRouter();
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [editing, setEditing] = useState<AdminServiceView | null>(null);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});

  function openCreate() {
    setForm(EMPTY_FORM);
    setFieldErrors({});
    setEditing(null);
    setCreating(true);
  }

  function openEdit(service: AdminServiceView) {
    setForm({
      name: service.name,
      description: service.description,
      priceKwacha: String(toKwacha(service.priceNgwee)),
      durationMinutes: String(service.durationMinutes),
      priceFrom: service.priceFrom,
      active: service.active,
      featured: service.featured,
    });
    setFieldErrors({});
    setCreating(false);
    setEditing(service);
  }

  async function save() {
    setBusy(true);
    setError(null);
    setNote(null);
    setFieldErrors({});

    const payload = {
      name: form.name,
      description: form.description,
      priceKwacha: Number(form.priceKwacha),
      durationMinutes: Number(form.durationMinutes),
      priceFrom: form.priceFrom,
      active: form.active,
      featured: form.featured,
    };

    try {
      if (editing) {
        await apiRequest(`/api/admin/services/${editing.id}`, {
          method: "PATCH",
          json: payload,
        });
        setNote(`${form.name} updated.`);
      } else {
        await apiRequest("/api/admin/services", { method: "POST", json: payload });
        setNote(`${form.name} added.`);
      }
      setEditing(null);
      setCreating(false);
      router.refresh();
    } catch (caught) {
      if (caught instanceof ApiClientError) {
        setError(caught.message);
        setFieldErrors(caught.fields ?? {});
      } else {
        setError("Something went wrong. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function toggleActive(service: AdminServiceView) {
    setBusy(true);
    setError(null);
    try {
      await apiRequest(`/api/admin/services/${service.id}`, {
        method: "PATCH",
        json: { active: !service.active },
      });
      setNote(`${service.name} is now ${service.active ? "inactive" : "active"}.`);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  async function remove(service: AdminServiceView) {
    setBusy(true);
    setError(null);
    try {
      const result = await apiRequest<{ deleted: boolean; message: string }>(
        `/api/admin/services/${service.id}`,
        { method: "DELETE" },
      );
      setNote(result.message);
      router.refresh();
    } catch (caught) {
      setError(
        caught instanceof ApiClientError
          ? caught.message
          : "Something went wrong. Please try again.",
      );
    } finally {
      setBusy(false);
    }
  }

  const dialogOpen = creating || editing !== null;

  return (
    <div className="space-y-4">
      {error ? (
        <Alert tone="danger" title="That did not work">
          <p>{error}</p>
        </Alert>
      ) : null}
      {note ? (
        <Alert tone="success" title="Saved">
          <p>{note}</p>
        </Alert>
      ) : null}

      <Dialog
        open={dialogOpen}
        onOpenChange={(open) => {
          if (!open) {
            setCreating(false);
            setEditing(null);
          }
        }}
      >
        <DialogTrigger asChild>
          <Button onClick={openCreate}>
            <Plus aria-hidden />
            Add service
          </Button>
        </DialogTrigger>

        <DialogContent
          title={editing ? `Edit ${editing.name}` : "Add a service"}
          description="Prices are in Kwacha and shown to customers exactly as entered."
        >
          <form
            className="space-y-4"
            onSubmit={(event) => {
              event.preventDefault();
              void save();
            }}
          >
            <Field label="Name" htmlFor="service-name" required error={fieldErrors.name}>
              <Input
                id="service-name"
                value={form.name}
                onChange={(event) => setForm({ ...form, name: event.target.value })}
                required
              />
            </Field>

            <Field
              label="Description"
              htmlFor="service-description"
              required
              error={fieldErrors.description}
            >
              <Textarea
                id="service-description"
                rows={3}
                value={form.description}
                onChange={(event) => setForm({ ...form, description: event.target.value })}
                required
              />
            </Field>

            <div className="grid gap-4 sm:grid-cols-2">
              <Field
                label="Price (K)"
                htmlFor="service-price"
                required
                error={fieldErrors.priceKwacha}
              >
                <Input
                  id="service-price"
                  type="number"
                  min={0}
                  step={10}
                  inputMode="numeric"
                  value={form.priceKwacha}
                  onChange={(event) => setForm({ ...form, priceKwacha: event.target.value })}
                  required
                />
              </Field>

              <Field
                label="Duration (minutes)"
                htmlFor="service-duration"
                required
                error={fieldErrors.durationMinutes}
              >
                <Input
                  id="service-duration"
                  type="number"
                  min={15}
                  step={15}
                  inputMode="numeric"
                  value={form.durationMinutes}
                  onChange={(event) =>
                    setForm({ ...form, durationMinutes: event.target.value })
                  }
                  required
                />
              </Field>
            </div>

            <div className="space-y-2.5">
              <ToggleRow
                id="service-price-from"
                label='Show price as "From K…"'
                checked={form.priceFrom}
                onChange={(checked) => setForm({ ...form, priceFrom: checked })}
              />
              <ToggleRow
                id="service-active"
                label="Bookable by customers"
                checked={form.active}
                onChange={(checked) => setForm({ ...form, active: checked })}
              />
              <ToggleRow
                id="service-featured"
                label="Feature on the homepage"
                checked={form.featured}
                onChange={(checked) => setForm({ ...form, featured: checked })}
              />
            </div>

            <div className="flex flex-col gap-2.5 sm:flex-row">
              <Button type="submit" full loading={busy} loadingText="Saving…">
                {editing ? "Save changes" : "Add service"}
              </Button>
              <DialogClose asChild>
                <Button type="button" variant="secondary" full>
                  Cancel
                </Button>
              </DialogClose>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      <ul className="grid gap-3 sm:grid-cols-2">
        {services.map((service) => (
          <li key={service.id}>
            <Card className="h-full">
              <CardContent className="flex h-full flex-col gap-3 p-4 pt-4">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <h2 className="flex items-center gap-2 font-display text-lg text-ink">
                      {service.name}
                      {service.featured ? (
                        <Sparkles className="size-4 text-blush-400" aria-label="Featured" />
                      ) : null}
                    </h2>
                    <p className="text-xs text-ink-muted">
                      {formatDuration(service.durationMinutes)} · {service.bookingCount} booking
                      {service.bookingCount === 1 ? "" : "s"}
                    </p>
                  </div>
                  <div className="text-right">
                    <p className="font-display text-xl text-blush-800">
                      {formatKwacha(service.priceNgwee, { from: service.priceFrom })}
                    </p>
                    <Badge tone={service.active ? "success" : "muted"}>
                      {service.active ? "Active" : "Inactive"}
                    </Badge>
                  </div>
                </div>

                <p className="text-sm text-ink-soft">{service.description}</p>

                <div className="mt-auto flex flex-wrap gap-2">
                  <Button size="sm" variant="secondary" onClick={() => openEdit(service)}>
                    <Pencil aria-hidden /> Edit
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => toggleActive(service)}
                  >
                    {service.active ? "Deactivate" : "Activate"}
                  </Button>
                  <Button
                    size="sm"
                    variant="ghost"
                    disabled={busy}
                    onClick={() => remove(service)}
                  >
                    <Trash2 aria-hidden />
                    {service.bookingCount > 0 ? "Retire" : "Delete"}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </li>
        ))}
      </ul>
    </div>
  );
}

function ToggleRow({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label
      htmlFor={id}
      className="flex cursor-pointer items-center gap-3 rounded-2xl border border-line bg-white p-3 text-sm text-ink"
    >
      <Checkbox
        id={id}
        checked={checked}
        onCheckedChange={(value) => onChange(value === true)}
      />
      {label}
    </label>
  );
}
