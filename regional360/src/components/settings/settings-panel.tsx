"use client";

import * as React from "react";
import { RotateCcw, Save, Check } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { DEFAULT_THRESHOLDS, type Thresholds } from "@/lib/config";

export function SettingsPanel({ providerName }: { providerName: string }) {
  const [thresholds, setThresholds] = React.useState<Thresholds>(DEFAULT_THRESHOLDS);
  const [saved, setSaved] = React.useState(false);

  React.useEffect(() => {
    try {
      const raw = localStorage.getItem("r360-thresholds");
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (raw) setThresholds({ ...DEFAULT_THRESHOLDS, ...JSON.parse(raw) });
    } catch {
      /* ignore */
    }
  }, []);

  const update = (key: keyof Thresholds, value: number) =>
    setThresholds((t) => ({ ...t, [key]: value }));

  const save = () => {
    localStorage.setItem("r360-thresholds", JSON.stringify(thresholds));
    setSaved(true);
    setTimeout(() => setSaved(false), 1500);
  };

  const resetDemo = () => {
    ["r360-actions", "r360-coaching", "r360-thresholds"].forEach((k) => localStorage.removeItem(k));
    window.location.reload();
  };

  const fields: { key: keyof Thresholds; label: string; suffix: string }[] = [
    { key: "repPerformingAchievement", label: "Rep 'Performing' achievement ≥", suffix: "%" },
    { key: "repCriticalAchievement", label: "Rep 'Critical' achievement <", suffix: "%" },
    { key: "repHealthyCoverage", label: "Healthy pipeline coverage", suffix: "x" },
    { key: "accountHealthy", label: "Account 'Healthy' score ≥", suffix: "/100" },
    { key: "accountAtRisk", label: "Account 'At Risk' score ≥", suffix: "/100" },
    { key: "targetCoverage", label: "Target territory coverage", suffix: "x" },
  ];

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Demo Mode</CardTitle>
          <CardDescription>
            Regional360 runs entirely on realistic demo data — no external integrations or API
            keys required. Everything you see is generated in-app.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Switch checked disabled />
            <span className="text-sm">Demo data source <Badge variant="warning" className="ml-1">Active</Badge></span>
          </div>
          <Button variant="outline" size="sm" onClick={resetDemo}>
            <RotateCcw className="h-4 w-4" /> Reset local state
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Status thresholds</CardTitle>
          <CardDescription>
            Performance and health statuses derive from these thresholds — they are never
            arbitrary. Stored locally in this MVP.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            {fields.map((f) => (
              <div key={f.key} className="space-y-1.5">
                <Label htmlFor={f.key}>{f.label}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id={f.key}
                    type="number"
                    value={thresholds[f.key]}
                    onChange={(e) => update(f.key, Number(e.target.value))}
                    className="w-28"
                  />
                  <span className="text-sm text-muted-foreground">{f.suffix}</span>
                </div>
              </div>
            ))}
          </div>
          <Button onClick={save} size="sm">
            {saved ? <><Check className="h-4 w-4" /> Saved</> : <><Save className="h-4 w-4" /> Save thresholds</>}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>AI provider</CardTitle>
          <CardDescription>
            The AI layer is provider-agnostic. Set <code className="rounded bg-muted px-1">AI_PROVIDER</code> and
            provider keys via environment variables — keys are used server-side only.
          </CardDescription>
        </CardHeader>
        <CardContent className="flex items-center justify-between">
          <span className="text-sm">Active provider</span>
          <Badge variant="muted">{providerName}</Badge>
        </CardContent>
      </Card>
    </div>
  );
}
