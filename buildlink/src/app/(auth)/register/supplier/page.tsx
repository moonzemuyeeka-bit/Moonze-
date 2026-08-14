import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SupplierRegisterForm } from "@/app/(auth)/register/supplier/supplier-register-form";
import { Alert } from "@/components/ui/alert";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME_PATH } from "@/lib/auth/permissions";
import { getCategories, getProvinces } from "@/server/reference/queries";

export const metadata: Metadata = {
  title: "Register your business",
  description:
    "List your building materials on BuildLink Zambia. Register your business, add products and start receiving orders.",
};

export default async function SupplierRegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME_PATH[user.role]);

  const [provinces, categories] = await Promise.all([getProvinces(), getCategories()]);

  return (
    <div className="space-y-8 py-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Register your business
        </h1>
        <p className="text-foreground-muted">
          Free to join. You can add products immediately and upload verification documents once you
          are in.
        </p>
      </div>

      <Alert tone="info" title="What happens after you register">
        <p>
          Your business appears on BuildLink as <strong>pending verification</strong> straight away,
          and customers see that status honestly. Upload your PACRA certificate, tax clearance and
          director ID from your console, and our team reviews them before your verified badge
          appears.
        </p>
      </Alert>

      <SupplierRegisterForm provinces={provinces} categories={categories} />
    </div>
  );
}
