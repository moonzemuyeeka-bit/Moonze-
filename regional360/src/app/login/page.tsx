import {
  Compass,
  Sparkles,
  GaugeCircle,
  ShieldCheck,
  ArrowRight,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { loginDemoAction } from "@/lib/auth/actions";

export default function LoginPage() {
  return (
    <div className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <div className="relative hidden flex-col justify-between bg-sidebar p-10 text-sidebar-foreground lg:flex">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sidebar-primary/20 text-sidebar-primary">
            <Compass className="h-5 w-5" />
          </div>
          <span className="text-lg font-semibold">Regional360</span>
        </div>
        <div className="max-w-md space-y-6">
          <h1 className="text-3xl font-semibold leading-tight">
            An AI decision-support and execution system for Regional Managers.
          </h1>
          <p className="text-sidebar-muted">
            Not another CRM dashboard. Regional360 moves you from data to
            decision: understand what happened, why it happened, what to do
            next, and whether it worked.
          </p>
          <div className="space-y-3">
            {[
              { icon: GaugeCircle, text: "Diagnose the revenue gap across market, people, process and product." },
              { icon: Sparkles, text: "An AI Copilot that reasons over your regional data — with transparent evidence." },
              { icon: ShieldCheck, text: "Every recommendation shows its why, supporting data and confidence." },
            ].map((f, i) => (
              <div key={i} className="flex items-start gap-3">
                <f.icon className="mt-0.5 h-5 w-5 shrink-0 text-sidebar-primary" />
                <span className="text-sm text-sidebar-muted">{f.text}</span>
              </div>
            ))}
          </div>
        </div>
        <p className="text-xs text-sidebar-muted">
          Observe → Diagnose → Decide → Act → Measure
        </p>
      </div>

      {/* Login panel */}
      <div className="flex items-center justify-center p-6">
        <div className="w-full max-w-sm space-y-6">
          <div className="flex items-center gap-2 lg:hidden">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Compass className="h-5 w-5" />
            </div>
            <span className="text-lg font-semibold">Regional360</span>
          </div>

          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <h2 className="text-xl font-semibold">Sign in</h2>
              <Badge variant="warning">Demo Mode</Badge>
            </div>
            <p className="text-sm text-muted-foreground">
              Explore the full application instantly — no configuration or API
              keys required.
            </p>
          </div>

          <form action={loginDemoAction} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email">Work email</Label>
              <Input
                id="email"
                name="email"
                type="email"
                defaultValue="alex.morgan@regional360.example"
                readOnly
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                name="password"
                type="password"
                defaultValue="demo-access"
                readOnly
              />
            </div>
            <Button type="submit" className="w-full">
              Enter Demo Mode
              <ArrowRight className="h-4 w-4" />
            </Button>
          </form>

          <p className="text-center text-xs text-muted-foreground">
            Authentication is abstracted for the MVP. Enterprise SSO can be
            added without changing the app.
          </p>
        </div>
      </div>
    </div>
  );
}
