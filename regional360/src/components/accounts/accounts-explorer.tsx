"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowRight } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Progress } from "@/components/ui/progress";
import { HealthPill } from "@/components/shared/status-pill";
import { Trend } from "@/components/shared/trend";
import type { AccountHealth } from "@/lib/types";
import { formatCurrency } from "@/lib/utils";

export function AccountsExplorer({
  accounts,
  industries,
  territories,
}: {
  accounts: (AccountHealth & { industry: string })[];
  industries: string[];
  territories: string[];
}) {
  const [tier, setTier] = React.useState("all");
  const [industry, setIndustry] = React.useState("all");
  const [territory, setTerritory] = React.useState("all");
  const [query, setQuery] = React.useState("");

  const filtered = accounts.filter((a) => {
    if (tier !== "all" && a.tier !== tier) return false;
    if (industry !== "all" && a.industry !== industry) return false;
    if (territory !== "all" && a.territoryName !== territory) return false;
    if (query && !a.account.name.toLowerCase().includes(query.toLowerCase())) return false;
    return true;
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <Input
          placeholder="Search accounts…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="h-8 w-full sm:w-52"
        />
        <Select value={tier} onValueChange={setTier}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Health" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All health</SelectItem>
            <SelectItem value="Healthy">Healthy</SelectItem>
            <SelectItem value="At Risk">At Risk</SelectItem>
            <SelectItem value="Critical">Critical</SelectItem>
          </SelectContent>
        </Select>
        <Select value={industry} onValueChange={setIndustry}>
          <SelectTrigger className="h-8 w-40"><SelectValue placeholder="Industry" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All industries</SelectItem>
            {industries.map((i) => <SelectItem key={i} value={i}>{i}</SelectItem>)}
          </SelectContent>
        </Select>
        <Select value={territory} onValueChange={setTerritory}>
          <SelectTrigger className="h-8 w-36"><SelectValue placeholder="Territory" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">All territories</SelectItem>
            {territories.map((t) => <SelectItem key={t} value={t}>{t}</SelectItem>)}
          </SelectContent>
        </Select>
        <span className="ml-auto text-sm text-muted-foreground">{filtered.length} accounts</span>
      </div>

      <div className="rounded-xl border border-border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Account</TableHead>
              <TableHead>Industry</TableHead>
              <TableHead>Owner</TableHead>
              <TableHead className="text-right">Revenue</TableHead>
              <TableHead className="text-right">Rev. trend</TableHead>
              <TableHead className="w-40">Health</TableHead>
              <TableHead className="text-right">Issues</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filtered.map((a) => (
              <TableRow key={a.account.id}>
                <TableCell>
                  <Link href={`/accounts/${a.account.id}`} className="font-medium hover:underline">
                    {a.account.name}
                  </Link>
                  <p className="text-xs text-muted-foreground">{a.territoryName}</p>
                </TableCell>
                <TableCell className="text-sm">{a.industry}</TableCell>
                <TableCell className="whitespace-nowrap text-sm">{a.ownerName}</TableCell>
                <TableCell className="text-right text-sm font-medium">{formatCurrency(a.account.annualRevenue, { compact: true })}</TableCell>
                <TableCell className="text-right"><Trend value={a.account.revenueTrendPct} /></TableCell>
                <TableCell>
                  <div className="flex items-center gap-2">
                    <Progress
                      value={a.healthScore}
                      className="h-1.5 w-16"
                      indicatorClassName={a.tier === "Healthy" ? "bg-success" : a.tier === "At Risk" ? "bg-warning" : "bg-destructive"}
                    />
                    <HealthPill tier={a.tier} />
                  </div>
                </TableCell>
                <TableCell className="text-right text-sm">{a.openIssues || "—"}</TableCell>
                <TableCell className="text-right">
                  <Link href={`/accounts/${a.account.id}`} className="inline-flex items-center text-primary">
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </div>
  );
}
