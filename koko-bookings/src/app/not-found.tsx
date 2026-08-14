import Link from "next/link";
import { CalendarHeart, Home, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export const metadata = { title: "Page not found" };

export default function NotFound() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-lg items-center px-4 py-10">
      <Card className="w-full">
        <CardContent className="space-y-4 p-6 pt-6 text-center">
          <span className="mx-auto flex size-14 items-center justify-center rounded-full bg-blush-100 text-blush-600">
            <Search className="size-7" aria-hidden />
          </span>
          <h1 className="font-display text-3xl text-ink">We could not find that page</h1>
          <p className="text-ink-soft">
            The link may be out of date. You can start a new booking or look up an
            appointment you have already made.
          </p>

          <div className="flex flex-col gap-2.5 pt-1 sm:flex-row sm:justify-center">
            <Button asChild size="lg">
              <Link href="/book">
                <CalendarHeart aria-hidden />
                Book an appointment
              </Link>
            </Button>
            <Button asChild variant="secondary" size="lg">
              <Link href="/">
                <Home aria-hidden />
                Back to the homepage
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </main>
  );
}
