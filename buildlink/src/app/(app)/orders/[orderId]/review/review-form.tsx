"use client";

import * as React from "react";
import { useActionState } from "react";
import { Send } from "lucide-react";
import { Field } from "@/components/ui/field";
import { Textarea } from "@/components/ui/input";
import { StarRatingInput } from "@/components/ui/star-rating";
import { SubmitButton } from "@/components/forms/submit-button";
import { FormMessage, fieldError } from "@/components/forms/form-message";
import { submitReviewAction, type ReviewActionState } from "@/server/reviews/actions";

/**
 * Review form.
 *
 * The overall star rating is the only required answer, because a customer who
 * has just taken delivery of thirty bags of cement will not fill in six scales.
 * The detailed ratings are offered, not demanded — and they are what make a
 * supplier's profile useful to the next person building a house.
 */

const DETAIL_RATINGS = [
  { name: "productQualityRating", label: "Quality of what arrived" },
  { name: "priceRating", label: "Value for the price" },
  { name: "deliveryRating", label: "Delivery" },
  { name: "communicationRating", label: "Communication" },
  { name: "reliabilityRating", label: "Reliability" },
] as const;

export function ReviewForm({
  orderId,
  supplierName,
  initial,
}: {
  orderId: string;
  supplierName: string;
  initial?: {
    rating: number;
    productQualityRating: number | null;
    priceRating: number | null;
    deliveryRating: number | null;
    communicationRating: number | null;
    reliabilityRating: number | null;
    comment: string | null;
  };
}) {
  const [state, formAction] = useActionState<ReviewActionState, FormData>(
    submitReviewAction,
    null,
  );

  const [rating, setRating] = React.useState(initial?.rating ?? 0);
  const [details, setDetails] = React.useState<Record<string, number>>({
    productQualityRating: initial?.productQualityRating ?? 0,
    priceRating: initial?.priceRating ?? 0,
    deliveryRating: initial?.deliveryRating ?? 0,
    communicationRating: initial?.communicationRating ?? 0,
    reliabilityRating: initial?.reliabilityRating ?? 0,
  });

  return (
    <form action={formAction} className="space-y-6">
      <input type="hidden" name="orderId" value={orderId} />
      <FormMessage state={state} />

      <StarRatingInput
        name="rating"
        value={rating}
        onChange={setRating}
        label={`Overall, how was buying from ${supplierName}?`}
        required
      />
      {fieldError(state, "rating") ? (
        <p className="text-xs text-danger-700">{fieldError(state, "rating")?.join(" ")}</p>
      ) : null}

      <fieldset className="space-y-4 rounded-lg border border-border bg-surface-muted/50 p-4">
        <legend className="px-1 text-sm font-medium text-foreground">
          More detail (optional)
        </legend>
        {DETAIL_RATINGS.map((detail) => (
          <StarRatingInput
            key={detail.name}
            name={detail.name}
            value={details[detail.name] ?? 0}
            onChange={(value) =>
              setDetails((current) => ({ ...current, [detail.name]: value }))
            }
            label={detail.label}
          />
        ))}
      </fieldset>

      <Field
        name="comment"
        label="What should the next customer know?"
        hint="Were the quantities right? Did delivery arrive when promised? Keep it factual — your review is published on the supplier's profile with your name."
        error={fieldError(state, "comment")}
      >
        {(control) => (
          <Textarea
            {...control}
            rows={5}
            maxLength={1500}
            defaultValue={initial?.comment ?? ""}
            placeholder="The cement was fresh and the driver called before arriving. Two bags were short and they replaced them the next day."
          />
        )}
      </Field>

      <SubmitButton pendingText="Publishing…" disabled={rating === 0}>
        <Send aria-hidden />
        Publish review
      </SubmitButton>
    </form>
  );
}
