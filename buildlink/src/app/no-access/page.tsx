import Link from "next/link";
import type { Metadata } from "next";
import { Lock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";
import { getCurrentUser } from "@/lib/auth/session";
import { ROLE_HOME_PATH } from "@/lib/auth/permissions";
import { USER_ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = {
  title: "No access",
  robots: { index: false, follow: false },
};

export default async function NoAccessPage() {
  const user = await getCurrentUser();

  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Logo />
      <span className="flex size-14 items-center justify-center rounded-full bg-warning-50 text-warning-700">
        <Lock className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">You do not have access to that</h1>
        <p className="text-foreground-muted">
          {user
            ? `Your account is signed in as a ${USER_ROLE_LABELS[user.role].toLowerCase()}, which does not include this area.`
            : "Please sign in with an account that has permission for this area."}
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        {user ? (
          <Button asChild>
            <Link href={ROLE_HOME_PATH[user.role]}>Go to my dashboard</Link>
          </Button>
        ) : (
          <Button asChild>
            <Link href="/login">Sign in</Link>
          </Button>
        )}
        <Button asChild variant="outline">
          <Link href="/marketplace">Browse the marketplace</Link>
        </Button>
      </div>
    </main>
  );
}
