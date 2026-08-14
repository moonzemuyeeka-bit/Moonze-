import Link from "next/link";
import { Compass } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/brand/logo";

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="mx-auto flex min-h-dvh w-full max-w-xl flex-col items-center justify-center gap-6 px-4 text-center"
    >
      <Logo />
      <span className="flex size-14 items-center justify-center rounded-full bg-brand-50 text-brand-700">
        <Compass className="size-7" />
      </span>
      <div className="space-y-2">
        <h1 className="text-2xl font-semibold tracking-tight">We could not find that page</h1>
        <p className="text-foreground-muted">
          The link may be out of date, or the project, product or order may have been removed.
        </p>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Button asChild>
          <Link href="/marketplace">Browse the marketplace</Link>
        </Button>
        <Button asChild variant="outline">
          <Link href="/">Back to home</Link>
        </Button>
      </div>
    </main>
  );
}
