import { z } from "zod";
import {
  checkboxSchema,
  emailSchema,
  optionalText,
  optionalZambianPhoneSchema,
  requiredText,
  uuidSchema,
  zambianPhoneSchema,
} from "@/lib/validation/shared";
import { describePasswordProblems, PASSWORD_MIN_LENGTH } from "@/lib/auth/password";

const passwordSchema = z
  .string()
  .min(PASSWORD_MIN_LENGTH, `Use at least ${PASSWORD_MIN_LENGTH} characters.`)
  .max(200, "That password is too long.");

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, "Enter your password."),
  next: optionalText(300),
});

export const registerCustomerSchema = z
  .object({
    name: requiredText("Your name", 120, 2),
    email: emailSchema,
    phone: optionalZambianPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    acceptTerms: checkboxSchema,
    next: optionalText(300),
  })
  .superRefine((value, ctx) => {
    for (const problem of describePasswordProblems(value.password, value.email)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    }
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    }
    if (!value.acceptTerms) {
      ctx.addIssue({
        code: "custom",
        path: ["acceptTerms"],
        message: "Please confirm you understand how BuildLink handles payments.",
      });
    }
  });

export const registerSupplierSchema = z
  .object({
    // Account
    contactName: requiredText("Contact person", 120, 2),
    email: emailSchema,
    phone: zambianPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),

    // Business
    businessName: requiredText("Business name", 160, 2),
    description: optionalText(1200),
    provinceId: uuidSchema,
    districtId: z
      .string()
      .transform((value) => (value.trim() === "" ? null : value.trim()))
      .nullable()
      .optional(),
    address: optionalText(300),
    categoryIds: z
      .array(uuidSchema)
      .min(1, "Choose at least one category you supply.")
      .max(15, "That is more categories than BuildLink has."),
    deliveryAvailable: checkboxSchema,
    yearsOperating: z
      .string()
      .transform((value) => (value.trim() === "" ? null : Number(value)))
      .nullable()
      .optional()
      .superRefine((value, ctx) => {
        if (value !== null && value !== undefined && (!Number.isInteger(value) || value < 0 || value > 150)) {
          ctx.addIssue({ code: "custom", message: "Enter a number of years between 0 and 150." });
        }
      }),
    registrationNumber: optionalText(60),
    taxpayerNumber: optionalText(40),
    acceptTerms: checkboxSchema,
  })
  .superRefine((value, ctx) => {
    for (const problem of describePasswordProblems(value.password, value.email)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    }
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    }
    if (!value.acceptTerms) {
      ctx.addIssue({
        code: "custom",
        path: ["acceptTerms"],
        message: "Please confirm the business details you have given are accurate.",
      });
    }
  });

export const registerDeliveryProviderSchema = z
  .object({
    contactName: requiredText("Contact person", 120, 2),
    email: emailSchema,
    phone: zambianPhoneSchema,
    password: passwordSchema,
    confirmPassword: z.string(),
    businessName: requiredText("Business or trading name", 160, 2),
    type: z.enum(["INDEPENDENT_DRIVER", "LOGISTICS_COMPANY"]),
    description: optionalText(1000),
    provinceId: uuidSchema,
    acceptTerms: checkboxSchema,
  })
  .superRefine((value, ctx) => {
    for (const problem of describePasswordProblems(value.password, value.email)) {
      ctx.addIssue({ code: "custom", path: ["password"], message: problem });
    }
    if (value.password !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    }
    if (!value.acceptTerms) {
      ctx.addIssue({
        code: "custom",
        path: ["acceptTerms"],
        message: "Please confirm the details you have given are accurate.",
      });
    }
  });

export const changePasswordSchema = z
  .object({
    currentPassword: z.string().min(1, "Enter your current password."),
    newPassword: passwordSchema,
    confirmPassword: z.string(),
  })
  .superRefine((value, ctx) => {
    for (const problem of describePasswordProblems(value.newPassword)) {
      ctx.addIssue({ code: "custom", path: ["newPassword"], message: problem });
    }
    if (value.newPassword !== value.confirmPassword) {
      ctx.addIssue({
        code: "custom",
        path: ["confirmPassword"],
        message: "The two passwords do not match.",
      });
    }
  });

export const updateProfileSchema = z.object({
  name: requiredText("Your name", 120, 2),
  phone: optionalZambianPhoneSchema,
});

export type LoginInput = z.infer<typeof loginSchema>;
export type RegisterCustomerInput = z.infer<typeof registerCustomerSchema>;
export type RegisterSupplierInput = z.infer<typeof registerSupplierSchema>;
export type RegisterDeliveryProviderInput = z.infer<typeof registerDeliveryProviderSchema>;
