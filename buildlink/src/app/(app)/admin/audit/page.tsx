import type { Metadata } from "next";
import Link from "next/link";
import { ScrollText, Search } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { Alert } from "@/components/ui/alert";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatTimestamp } from "@/components/ui/timeline";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
  TableWrapper,
} from "@/components/ui/table";
import { requirePageAdmin } from "@/lib/auth/guards";
import { ADMIN_PAGE_SIZE, listAuditLog } from "@/server/admin/queries";
import { USER_ROLE_LABELS } from "@/lib/labels";

export const metadata: Metadata = {
  title: "Audit log",
  description: "Every privileged action taken on BuildLink, and who took it.",
};

/** Resource types worth filtering by, in the order an administrator looks for them. */
const RESOURCE_TYPES = [
  "user",
  "supplier",
  "supplier_document",
  "product",
  "order",
  "payment",
  "contract",
  "delivery",
  "dispute",
  "review",
  "platform_setting",
] as const;

/**
 * Renders an audit value as readable key/value text.
 *
 * Audit values are stored as JSON so the shape can change with the schema. That
 * flexibility is worth having, but it means this screen cannot assume anything,
 * so it formats defensively rather than reaching for named fields.
 */
function describeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "object") return String(value);

  const entries = Object.entries(value as Record<string, unknown>).filter(
    ([, entry]) => entry !== null && entry !== undefined && entry !== "",
  );
  if (entries.length === 0) return null;

  return entries
    .map(([key, entry]) => `${key}: ${typeof entry === "object" ? JSON.stringify(entry) : String(entry)}`)
    .join(" · ");
}

/**
 * The audit log.
 *
 * This exists so that no administrative action is deniable. Nothing on this page
 * can be edited or deleted — including by the administrator reading it — because
 * a log that can be tidied up is not evidence of anything.
 */
export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/audit");
  const params = await searchParams;

  const action = typeof params.action === "string" ? params.action : "";
  const resourceTypeParam = typeof params.resource === "string" ? params.resource : "";
  const resourceType = RESOURCE_TYPES.find((type) => type === resourceTypeParam) ?? "";
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const { entries, total, pageCount, actions } = await listAuditLog({
    action: action || undefined,
    resourceType: resourceType || undefined,
    search: search || undefined,
    page,
  });

  function hrefFor(next: { page?: number }): string {
    const query = new URLSearchParams();
    if (action) query.set("action", action);
    if (resourceType) query.set("resource", resourceType);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/admin/audit?${suffix}` : "/admin/audit";
  }

  const filtered = Boolean(action || resourceType || search);

  return (
    <div className="space-y-5">
      <PageHeader
        title="Audit log"
        description="Every privileged action on BuildLink, with the actor, the resource and what changed."
      />

      <Alert tone="info" title="Append-only">
        Nothing here can be edited or removed, by anyone, including administrators. Entries are
        written inside the same database transaction as the change they describe, so an action
        without an audit row is impossible.
      </Alert>

      <form action="/admin/audit" className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <div>
          <label
            htmlFor="audit-action"
            className="mb-1 block text-xs font-medium text-foreground-muted"
          >
            Action
          </label>
          <NativeSelect id="audit-action" name="action" defaultValue={action}>
            <option value="">Every action</option>
            {actions.map((option) => (
              <option key={option.action} value={option.action}>
                {option.action} ({option.count})
              </option>
            ))}
          </NativeSelect>
        </div>

        <div>
          <label
            htmlFor="audit-resource"
            className="mb-1 block text-xs font-medium text-foreground-muted"
          >
            Resource
          </label>
          <NativeSelect id="audit-resource" name="resource" defaultValue={resourceType}>
            <option value="">Every resource</option>
            {RESOURCE_TYPES.map((type) => (
              <option key={type} value={type}>
                {type.replace(/_/g, " ")}
              </option>
            ))}
          </NativeSelect>
        </div>

        <div>
          <label htmlFor="audit-search" className="mb-1 block text-xs font-medium text-foreground-muted">
            Actor or resource id
          </label>
          <Input
            id="audit-search"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Name, email, or an exact id"
          />
        </div>

        <div className="flex items-end gap-2">
          <Button type="submit" variant="outline">
            <Search aria-hidden />
            Apply
          </Button>
          {filtered ? (
            <Button asChild variant="ghost">
              <Link href="/admin/audit">Clear</Link>
            </Button>
          ) : null}
        </div>
      </form>

      {entries.length === 0 ? (
        <EmptyState
          icon={ScrollText}
          title={filtered ? "Nothing matches these filters" : "Nothing has been recorded yet"}
          description={
            filtered
              ? "Widen the filters — the action names are exact, and the id search needs a full identifier."
              : "The log fills up as soon as anyone verifies a supplier, moderates a listing or changes a setting."
          }
          action={
            filtered ? (
              <Button asChild variant="outline">
                <Link href="/admin/audit">Clear the filters</Link>
              </Button>
            ) : null
          }
        />
      ) : (
        <TableWrapper label="Audit log entries">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>When</TableHead>
                <TableHead>Actor</TableHead>
                <TableHead>Action</TableHead>
                <TableHead>Resource</TableHead>
                <TableHead>Change</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {entries.map((entry) => {
                const before = describeValue(entry.previousValue);
                const after = describeValue(entry.newValue);

                return (
                  <TableRow key={entry.id}>
                    <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                      <time dateTime={entry.createdAt.toISOString()}>
                        {formatTimestamp(entry.createdAt)}
                      </time>
                      {entry.ipAddress ? (
                        <span className="block text-foreground-subtle">{entry.ipAddress}</span>
                      ) : null}
                    </TableCell>
                    <TableCell className="text-sm">
                      {entry.actor ? (
                        <Link
                          href={`/admin/users/${entry.actor.id}`}
                          className="font-medium text-foreground hover:underline"
                        >
                          {entry.actor.name}
                        </Link>
                      ) : (
                        <span className="text-foreground-muted">System</span>
                      )}
                      {entry.actorRole ? (
                        <Badge tone="neutral" size="sm" className="ml-2">
                          {USER_ROLE_LABELS[entry.actorRole]}
                        </Badge>
                      ) : null}
                    </TableCell>
                    <TableCell className="font-mono text-xs text-foreground">
                      {entry.action}
                    </TableCell>
                    <TableCell className="text-xs text-foreground-muted">
                      {entry.resourceType.replace(/_/g, " ")}
                      <span className="block font-mono text-foreground-subtle">
                        {entry.resourceId}
                      </span>
                    </TableCell>
                    <TableCell className="max-w-md text-xs">
                      {after ? (
                        <span className="block text-foreground">{after}</span>
                      ) : (
                        <span className="text-foreground-subtle">—</span>
                      )}
                      {before ? (
                        <span className="block text-foreground-muted">was {before}</span>
                      ) : null}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {entries.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={ADMIN_PAGE_SIZE}
          itemNoun="entry"
          itemNounPlural="entries"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
