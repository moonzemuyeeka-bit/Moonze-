"use server";

import { redirect } from "next/navigation";
import { createDemoSession, destroySession } from "@/lib/auth";

export async function loginDemoAction() {
  await createDemoSession();
  redirect("/briefing");
}

export async function logoutAction() {
  await destroySession();
  redirect("/login");
}
