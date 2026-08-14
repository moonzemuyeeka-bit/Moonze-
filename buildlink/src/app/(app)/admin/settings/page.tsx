import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/ui/page-header";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Alert } from "@/components/ui/alert";
import { formatTimestamp } from "@/components/ui/timeline";
import { requirePageAdmin } from "@/lib/auth/guards";
import { db } from "@/lib/db";
import { getPlatformSettings } from "@/server/reference/queries";
import { PLATFORM_SETTING_LABELS, type PlatformSettingKey } from "@/lib/platform-settings";
import { PlatformSettingsForm } from "./settings-form";

export const metadata: Metadata = {
  title: "Platform settings",
  description: "Commission, subscription pricing and the thresholds the product uses.",
};

/**
 * Platform settings.
 *
 * These are commercial decisions, not deployment constants: commission is off at
 * launch and turning it on changes what every supplier is charged, so it belongs
 * behind a super-administrator check with an audit trail rather than in an
 * environment variable somebody redeploys.
 */
export default async function AdminSettingsPage() {
  const admin = await requirePageAdmin("/admin/settings");
  const canEdit = admin.role === "SUPER_ADMIN";

  const [settings, overrides, changes] = await Promise.all([
    getPlatformSettings(),
    db.supplierProfile.count({ where: { deletedAt: null, commissionRateBps: { not: null } } }),
    db.auditLog.findMany({
      where: { resourceType: "platform_setting" },
      orderBy: { createdAt: "desc" },
      take: 8,
      select: {
        id: true,
        resourceId: true,
        newValue: true,
        createdAt: true,
        actor: { select: { name: true } },
      },
    }),
  ]);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Platform settings"
        description="What BuildLink charges, and the thresholds the product uses when it warns or nudges people."
      />

      {settings["commission.enabled"] === true ? (
        <Alert tone="warning" title="Commission is being charged">
          Every order placed from now on records commission at the default rate, unless the supplier
          has their own rate on their business record.
        </Alert>
      ) : (
        <Alert tone="info" title="Commission is switched off">
          Suppliers are trading free of charge while BuildLink builds up liquidity. Orders record a
          zero rate. Turning it on affects orders placed afterwards only — nothing is applied
          retrospectively.
        </Alert>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div className="lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Commercial configuration</CardTitle>
            </CardHeader>
            <CardContent>
              <PlatformSettingsForm settings={settings} canEdit={canEdit} />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle>Supplier overrides</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground-muted">
              <p>
                <span className="text-2xl font-semibold text-foreground">{overrides}</span>{" "}
                {overrides === 1 ? "business has" : "businesses have"} a commission rate of their
                own, which takes precedence over the default here.
              </p>
              <Button asChild variant="ghost" size="sm" className="-ml-2">
                <Link href="/admin/suppliers">Review suppliers</Link>
              </Button>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Recent changes</CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              {changes.length === 0 ? (
                <p className="px-5 pb-5 text-sm text-foreground-muted">
                  No setting has been changed since launch. Every change is recorded here and in the
                  audit log.
                </p>
              ) : (
                <ul className="divide-y divide-border">
                  {changes.map((change) => (
                    <li key={change.id} className="px-4 py-3">
                      <p className="text-sm font-medium text-foreground">
                        {PLATFORM_SETTING_LABELS[change.resourceId as PlatformSettingKey] ??
                          change.resourceId}
                      </p>
                      <p className="text-xs text-foreground-muted">
                        {change.actor?.name ?? "System"} · {formatTimestamp(change.createdAt)}
                      </p>
                      {change.newValue && typeof change.newValue === "object" ? (
                        <Badge tone="neutral" size="sm" className="mt-1">
                          {String((change.newValue as { value?: unknown }).value)}
                        </Badge>
                      ) : null}
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>Not configurable here</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2 text-sm text-foreground-muted">
              <p>
                Payment providers, storage and email are deployment concerns and live in environment
                variables, not in this form — a compromised admin session must not be able to
                redirect payments or file storage.
              </p>
              <p>
                BuildLink never holds customer funds, so there is no float, fee or settlement setting
                to configure.
              </p>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
