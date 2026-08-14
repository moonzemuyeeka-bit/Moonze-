import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { DeliveryRegisterForm } from "@/app/(auth)/register/delivery/delivery-register-form";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME_PATH } from "@/lib/auth/permissions";
import { getProvinces } from "@/server/reference/queries";

export const metadata: Metadata = {
  title: "Deliver with BuildLink",
  description:
    "Register your truck or haulage business to take building-material delivery jobs from BuildLink Zambia suppliers and customers.",
};

export default async function DeliveryRegisterPage() {
  const user = await getCurrentUser();
  if (user) redirect(ROLE_HOME_PATH[user.role]);

  const provinces = await getProvinces();

  return (
    <div className="space-y-8 py-4">
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">
          Deliver with BuildLink
        </h1>
        <p className="text-foreground-muted">
          Sand, stone, blocks and cement need moving every day. Register your vehicles and take
          delivery jobs from suppliers and customers on BuildLink.
        </p>
      </div>

      <DeliveryRegisterForm provinces={provinces} />
    </div>
  );
}
