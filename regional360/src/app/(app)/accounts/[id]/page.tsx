import Link from "next/link";
import { notFound } from "next/navigation";
import {
  ArrowLeft,
  Building2,
  TrendingUp,
  CalendarClock,
  Boxes,
  AlertCircle,
} from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { Separator } from "@/components/ui/separator";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { HealthPill } from "@/components/shared/status-pill";
import { AiAnswerCard } from "@/components/shared/ai-answer-card";
import { SetCopilotContext } from "@/components/layout/page-context";
import {
  accountById,
  getIssues,
  getOpportunities,
  productName,
  salespersonName,
  territoryName,
  getProducts,
} from "@/lib/repositories";
import {
  accountHealth,
  accountRetentionInsight,
  crossSellRecommendations,
} from "@/lib/services/accounts";
import { formatCurrency, formatDate, formatPercent } from "@/lib/utils";

export default async function AccountDetailPage({
  params,
}: PageProps<"/accounts/[id]">) {
  const { id } = await params;
  const account = accountById(id);
  if (!account) notFound();

  const health = accountHealth(account);
  const insight = accountRetentionInsight(account);
  const cross = crossSellRecommendations(account);
  const issues = getIssues().filter((i) => i.accountId === account.id);
  const openOpps = getOpportunities().filter(
    (o) => o.accountId === account.id && !o.stage.startsWith("Closed"),
  );
  const ownedIds = new Set(account.products.map((p) => p.productId));
  const notUsed = getProducts().filter((p) => !ownedIds.has(p.id));

  return (
    <div className="space-y-6">
      <SetCopilotContext module="accounts" label={account.name} />
      <Link href="/accounts" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> Back to accounts
      </Link>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{account.name}</h1>
            <HealthPill tier={health.tier} />
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            {account.industry} · {territoryName(account.territoryId)} · Owner {salespersonName(account.ownerId)} · {account.relationshipStatus}
          </p>
        </div>
        <div className="flex items-center gap-3 rounded-lg border border-border px-4 py-2">
          <div className="text-center">
            <p className="text-2xl font-semibold">{health.healthScore}</p>
            <p className="text-xs text-muted-foreground">Health / 100</p>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        {[
          { label: "Annual revenue", value: formatCurrency(account.annualRevenue, { compact: true }), icon: Building2 },
          { label: "Potential", value: formatCurrency(account.potentialRevenue, { compact: true }), icon: TrendingUp },
          { label: "Penetration", value: formatPercent(health.penetrationPct), icon: Boxes },
          { label: "Expansion", value: formatCurrency(health.expansionPotential, { compact: true }), icon: TrendingUp },
          { label: "Renewal", value: health.daysToRenewal !== null ? `${health.daysToRenewal}d` : "—", icon: CalendarClock },
        ].map((k) => (
          <Card key={k.label} className="p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs uppercase tracking-wide text-muted-foreground">{k.label}</span>
              <k.icon className="h-4 w-4 text-muted-foreground" />
            </div>
            <p className="mt-2 text-xl font-semibold">{k.value}</p>
          </Card>
        ))}
      </div>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Health score breakdown</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {health.signals.map((s) => (
              <div key={s.label} className="space-y-1">
                <div className="flex items-center justify-between text-sm">
                  <span>{s.label}</span>
                  <span className={s.impact < 0 ? "text-destructive" : s.impact > 0 ? "text-success" : "text-muted-foreground"}>
                    {s.impact > 0 ? "+" : ""}{s.impact}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="relative h-1.5 flex-1 rounded-full bg-muted">
                    <div
                      className={`absolute top-0 h-1.5 rounded-full ${s.impact < 0 ? "bg-destructive" : "bg-success"}`}
                      style={{
                        width: `${Math.min(50, Math.abs(s.impact) * 2)}%`,
                        left: s.impact < 0 ? "50%" : undefined,
                        right: s.impact >= 0 ? "50%" : undefined,
                      }}
                    />
                    <div className="absolute left-1/2 top-[-2px] h-2.5 w-px bg-border" />
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{s.detail}</p>
              </div>
            ))}
          </CardContent>
        </Card>

        <div>
          <AiAnswerCard answer={insight} />
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Cross-sell & upsell opportunities</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {cross.slice(0, 3).map((c) => (
              <div key={c.product.id} className="rounded-lg border border-border p-3">
                <div className="flex items-center justify-between">
                  <p className="text-sm font-medium">{c.product.name}</p>
                  <Badge variant="default">{c.peerAdoptionPct}% peers</Badge>
                </div>
                <p className="mt-1 text-xs text-muted-foreground">{c.product.category}</p>
                <p className="mt-2 text-lg font-semibold">{formatCurrency(c.estimatedValue, { compact: true })}</p>
                <p className="text-xs text-muted-foreground">Estimated opportunity</p>
              </div>
            ))}
            {cross.length === 0 && (
              <p className="text-sm text-muted-foreground">Account owns the full product set.</p>
            )}
          </div>
          {notUsed.length > 0 && (
            <>
              <Separator className="my-4" />
              <p className="text-sm text-muted-foreground">
                <span className="font-medium text-foreground">Not yet used:</span>{" "}
                {notUsed.map((p) => p.name).join(", ")}
              </p>
            </>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-5 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>Open opportunities ({openOpps.length})</CardTitle>
          </CardHeader>
          <CardContent>
            {openOpps.length === 0 ? (
              <p className="text-sm text-muted-foreground">No open opportunities.</p>
            ) : (
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead>Stage</TableHead>
                    <TableHead className="text-right">Value</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {openOpps.map((o) => (
                    <TableRow key={o.id}>
                      <TableCell className="text-sm">{productName(o.productId)}</TableCell>
                      <TableCell><Badge variant="secondary">{o.stage}</Badge></TableCell>
                      <TableCell className="text-right text-sm font-medium">{formatCurrency(o.value, { compact: true })}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <AlertCircle className="h-4 w-4 text-muted-foreground" /> Issues & complaints
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {issues.length === 0 ? (
              <p className="text-sm text-muted-foreground">No recorded issues.</p>
            ) : (
              issues.map((i) => (
                <div key={i.id} className="flex items-start justify-between gap-2 rounded-lg border border-border px-3 py-2">
                  <div>
                    <p className="text-sm">{i.title}</p>
                    <p className="text-xs text-muted-foreground">Opened {formatDate(i.openedAt)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col items-end gap-1">
                    <Badge variant={i.severity === "High" ? "destructive" : i.severity === "Medium" ? "warning" : "muted"}>
                      {i.severity}
                    </Badge>
                    <Badge variant={i.status === "open" ? "outline" : "success"}>{i.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Contacts</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {account.contacts.map((c) => (
              <div key={c.id} className="rounded-lg border border-border p-3">
                <p className="text-sm font-medium">{c.name}</p>
                <p className="text-xs text-muted-foreground">{c.title}</p>
                <p className="mt-1 truncate text-xs text-muted-foreground">{c.email}</p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
