import { z } from "zod";
import { MAX_AMOUNT_MINOR, parseKwachaInput } from "@/lib/money";
import { normaliseZambianPhone } from "@/lib/zambia";

/**
 * Reusable validation building blocks.
 *
 * Every mutation in BuildLink parses its input through a Zod schema on the
 * server before touching the database. Client-side validation is a convenience;
 * this is the boundary that is actually enforced.
 */

export const trimmedString = (max: number) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max, `Please keep this under ${max} characters.`));

export const requiredText = (label: string, max = 200, min = 1) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(
      z
        .string()
        .min(min, `${label} is required.`)
        .max(max, `${label} must be ${max} characters or fewer.`),
    );

export const optionalText = (max = 2000) =>
  z
    .string()
    .transform((value) => value.trim())
    .pipe(z.string().max(max, `Please keep this under ${max} characters.`))
    .transform((value) => (value === "" ? null : value))
    .nullable()
    .optional();

export const emailSchema = z
  .string()
  .transform((value) => value.trim().toLowerCase())
  .pipe(z.email("Enter a valid email address.").max(254));

export const uuidSchema = z.uuid("That reference is not valid.");

/** Zambian mobile number, stored in E.164 (+2609XXXXXXXX). */
export const zambianPhoneSchema = z
  .string()
  .transform((value) => value.trim())
  .refine((value) => normaliseZambianPhone(value) !== null, {
    message: "Enter a Zambian mobile number, for example 0977 123 456.",
  })
  .transform((value) => normaliseZambianPhone(value) as string);

export const optionalZambianPhoneSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .superRefine((value, ctx) => {
    if (value && normaliseZambianPhone(value) === null) {
      ctx.addIssue({
        code: "custom",
        message: "Enter a Zambian mobile number, for example 0977 123 456.",
      });
    }
  })
  .transform((value) => (value ? normaliseZambianPhone(value) : null));

/**
 * Money entered by a person: accepts `12,500`, `12500.50`, `ZMW 12 500`, and
 * yields exact ngwee. Rejects anything above the per-field ceiling so a typo
 * cannot overflow an INTEGER column.
 */
export const zmwAmountSchema = (label = "Amount", options: { min?: number } = {}) =>
  z
    .union([z.string(), z.number()])
    .transform((value, ctx) => {
      const minor = parseKwachaInput(value);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number, for example 12500.` });
        return z.NEVER;
      }
      return minor;
    })
    .pipe(
      z
        .number()
        .int()
        .min(options.min ?? 0, `${label} cannot be negative.`)
        .max(MAX_AMOUNT_MINOR, `${label} is larger than BuildLink supports (ZMW 20,000,000).`),
    );

export const optionalZmwAmountSchema = (label = "Amount") =>
  z
    .union([z.string(), z.number()])
    .transform((value) => (typeof value === "string" && value.trim() === "" ? null : value))
    .nullable()
    .optional()
    .transform((value, ctx) => {
      if (value === null || value === undefined) return null;
      const minor = parseKwachaInput(value);
      if (minor === null) {
        ctx.addIssue({ code: "custom", message: `${label} must be a number, for example 12500.` });
        return z.NEVER;
      }
      if (minor < 0 || minor > MAX_AMOUNT_MINOR) {
        ctx.addIssue({ code: "custom", message: `${label} is outside the supported range.` });
        return z.NEVER;
      }
      return minor;
    });

export const positiveIntSchema = (label: string, max = 1_000_000) =>
  z.coerce
    .number({ message: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(1, `${label} must be at least 1.`)
    .max(max, `${label} cannot be more than ${max.toLocaleString("en-US")}.`);

export const nonNegativeIntSchema = (label: string, max = 10_000_000) =>
  z.coerce
    .number({ message: `${label} must be a whole number.` })
    .int(`${label} must be a whole number.`)
    .min(0, `${label} cannot be negative.`)
    .max(max, `${label} is too large.`);

export const optionalDateSchema = z
  .string()
  .transform((value) => value.trim())
  .transform((value) => (value === "" ? null : value))
  .nullable()
  .optional()
  .transform((value, ctx) => {
    if (!value) return null;
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) {
      ctx.addIssue({ code: "custom", message: "Enter a valid date." });
      return z.NEVER;
    }
    return date;
  });

export const checkboxSchema = z
  .union([z.literal("on"), z.literal("true"), z.literal("false"), z.literal(""), z.boolean()])
  .optional()
  .transform((value) => value === "on" || value === "true" || value === true);

/**
 * Turns a Zod failure into the `fieldErrors` shape server actions return.
 * Nested paths are joined with a dot so array/child fields stay addressable.
 */
export function fieldErrorsFrom(error: z.ZodError): Record<string, string[]> {
  const result: Record<string, string[]> = {};
  for (const issue of error.issues) {
    const key = issue.path.length > 0 ? issue.path.join(".") : "form";
    const existing = result[key];
    if (existing) existing.push(issue.message);
    else result[key] = [issue.message];
  }
  return result;
}

/** Parses a schema against FormData, throwing `ValidationError` on failure. */
export function formDataToObject(formData: FormData): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of formData.entries()) {
    if (value instanceof File) {
      // Files are handled explicitly by the actions that accept them.
      continue;
    }
    const existing = result[key];
    if (existing === undefined) {
      result[key] = value;
    } else if (Array.isArray(existing)) {
      existing.push(value);
    } else {
      result[key] = [existing, value];
    }
  }
  return result;
}

/** FormData values for a repeated field name, as a string array. */
export function formDataList(formData: FormData, key: string): string[] {
  return formData
    .getAll(key)
    .filter((value): value is string => typeof value === "string" && value.trim() !== "");
}
