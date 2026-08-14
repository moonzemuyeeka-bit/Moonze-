import { redirect } from "next/navigation";

/** `/admin` is not a screen; the console starts at the dashboard. */
export default function AdminIndexPage() {
  redirect("/admin/dashboard");
}
