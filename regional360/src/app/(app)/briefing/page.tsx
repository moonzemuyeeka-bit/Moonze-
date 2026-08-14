import Link from "next/link";
import {
  ArrowRight,
  CalendarCheck,
  CircleDot,
  Sparkles,
  TrendingUp,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { AiBadge } from "@/components/shared/demo-badge";
import { dailyBriefing } from "@/lib/services/briefing";
import { getSession } from "@/lib/auth";
import { formatCurrency, formatPercent } from "@/lib/utils";

export default async function BriefingPage() {
  const briefing = dailyBriefing();
  const user = await getSession();
  const firstName = user?.name.split(" ")[0] ?? "there";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          <AiBadge label="AI Regional Briefing" />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight">
          {briefing.greeting}, {firstName}.
        </h1>
        <p className="text-sm text-muted-foreground">
          Here is your regional briefing to start the day.
        </p>
      </div>

      <div className="grid gap-5 lg:grid-cols-3">
        <Card className="lg:col-span-1">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
              Yesterday
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <p className="text-3xl font-semibold">
                {formatCurrency(briefing.yesterday.revenue, { compact: true })}
              </p>
              <p className="text-sm text-muted-foreground">
                Revenue · Target {formatCurrency(briefing.yesterday.target, { compact: true })}
              </p>
            </div>
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-sm">
                <span className="text-muted-foreground">Achievement</span>
                <span className="font-medium">
                  {formatPercent(briefing.yesterday.achievementPct)}
                </span>
              </div>
              <Progress
                value={briefing.yesterday.achievementPct}
                indicatorClassName={
                  briefing.yesterday.achievementPct >= 100
                    ? "bg-success"
                    : briefing.yesterday.achievementPct >= 85
                      ? "bg-warning"
                      : "bg-destructive"
                }
              />
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-sm">
              <CircleDot className="h-4 w-4 text-muted-foreground" />
              Key developments
            </CardTitle>
          </CardHeader>
          <CardContent>
            <ul className="space-y-2.5">
              {briefing.developments.map((d, i) => (
                <li key={i} className="flex items-start gap-2.5 text-sm">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" />
                  <span>{d}</span>
                </li>
              ))}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-sm">
            <CalendarCheck className="h-4 w-4 text-muted-foreground" />
            Recommended priorities
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <ol className="space-y-2.5">
            {briefing.priorities.map((p, i) => (
              <li key={i} className="flex items-start gap-3 text-sm">
                <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
                  {i + 1}
                </span>
                <span>{p}</span>
              </li>
            ))}
          </ol>
          <Button asChild size="lg">
            <Link href="/actions">
              Start My Day
              <ArrowRight className="h-4 w-4" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
