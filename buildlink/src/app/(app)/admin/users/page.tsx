import type { Metadata } from "next";
import Link from "next/link";
import { Search, Users } from "lucide-react";
import { PageHeader } from "@/components/ui/page-header";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input, NativeSelect } from "@/components/ui/input";
import { EmptyState } from "@/components/ui/feedback";
import { Pagination, parsePage } from "@/components/ui/pagination";
import { formatDate } from "@/components/ui/timeline";
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
import { ADMIN_PAGE_SIZE, listUsers } from "@/server/admin/queries";
import { USER_ROLE_LABELS, USER_STATUS_LABELS, USER_STATUS_TONES } from "@/lib/labels";
import type { UserRole, UserStatus } from "@prisma/client";

export const metadata: Metadata = {
  title: "Users",
  description: "Everybody with a BuildLink account.",
};

const ROLES = [
  "CUSTOMER",
  "SUPPLIER",
  "DELIVERY_PROVIDER",
  "PROFESSIONAL",
  "ARTISAN",
  "ADMIN",
  "SUPER_ADMIN",
] as const satisfies readonly UserRole[];

const STATUSES = [
  "ACTIVE",
  "PENDING_VERIFICATION",
  "SUSPENDED",
  "DEACTIVATED",
] as const satisfies readonly UserStatus[];

function asRole(value: string | undefined): UserRole | undefined {
  return value && (ROLES as readonly string[]).includes(value) ? (value as UserRole) : undefined;
}

function asStatus(value: string | undefined): UserStatus | undefined {
  return value && (STATUSES as readonly string[]).includes(value)
    ? (value as UserStatus)
    : undefined;
}

/**
 * The account register.
 *
 * Search covers name, email and phone number, because a support conversation
 * starts with whichever of those the person happens to give. Nothing on this
 * screen changes an account — that needs the detail page, where the consequences
 * are spelled out.
 */
export default async function AdminUsersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePageAdmin("/admin/users");
  const params = await searchParams;

  const role = asRole(typeof params.role === "string" ? params.role : undefined);
  const status = asStatus(typeof params.status === "string" ? params.status : undefined);
  const search = typeof params.q === "string" ? params.q.trim() : "";
  const page = parsePage(params.page);

  const { users, total, pageCount } = await listUsers({ role, status, search, page });

  function hrefFor(next: { page?: number }): string {
    const query = new URLSearchParams();
    if (role) query.set("role", role);
    if (status) query.set("status", status);
    if (search) query.set("q", search);
    if (next.page && next.page > 1) query.set("page", String(next.page));
    const suffix = query.toString();
    return suffix ? `/admin/users?${suffix}` : "/admin/users";
  }

  return (
    <div className="space-y-5">
      <PageHeader
        title="Users"
        description={`${total} account${total === 1 ? "" : "s"} match this view.`}
      />

      <form action="/admin/users" className="flex flex-col gap-3 sm:flex-row sm:items-end">
        <div className="flex-1">
          <label htmlFor="q" className="mb-1.5 block text-sm font-medium text-foreground">
            Search
          </label>
          <Input
            id="q"
            name="q"
            type="search"
            defaultValue={search}
            placeholder="Name, email or phone number"
            className="h-10"
          />
        </div>
        <div className="sm:w-44">
          <label htmlFor="role" className="mb-1.5 block text-sm font-medium text-foreground">
            Role
          </label>
          <NativeSelect id="role" name="role" defaultValue={role ?? ""} className="h-10">
            <option value="">Every role</option>
            {ROLES.map((option) => (
              <option key={option} value={option}>
                {USER_ROLE_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <div className="sm:w-44">
          <label htmlFor="status" className="mb-1.5 block text-sm font-medium text-foreground">
            Status
          </label>
          <NativeSelect id="status" name="status" defaultValue={status ?? ""} className="h-10">
            <option value="">Any status</option>
            {STATUSES.map((option) => (
              <option key={option} value={option}>
                {USER_STATUS_LABELS[option]}
              </option>
            ))}
          </NativeSelect>
        </div>
        <Button type="submit" variant="outline">
          <Search aria-hidden />
          Apply
        </Button>
      </form>

      {users.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No account matches this view"
          description="Try a different role or status, or search for part of an email address."
          action={
            <Button asChild variant="outline">
              <Link href="/admin/users">Clear the filters</Link>
            </Button>
          }
        />
      ) : (
        <TableWrapper label="BuildLink accounts">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Person</TableHead>
                <TableHead>Role</TableHead>
                <TableHead>Status</TableHead>
                <TableHead numeric>Orders</TableHead>
                <TableHead>Joined</TableHead>
                <TableHead>Last signed in</TableHead>
                <TableHead>
                  <span className="sr-only">Open</span>
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((user) => (
                <TableRow key={user.id}>
                  <TableCell>
                    <span className="block font-medium text-foreground">{user.name}</span>
                    <span className="block text-xs text-foreground-muted">{user.email}</span>
                    {user.supplierName ? (
                      <span className="block text-xs text-foreground-subtle">
                        {user.supplierName}
                      </span>
                    ) : null}
                  </TableCell>
                  <TableCell>
                    <Badge tone="neutral" size="sm">
                      {USER_ROLE_LABELS[user.role]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <Badge tone={USER_STATUS_TONES[user.status]} size="sm">
                      {USER_STATUS_LABELS[user.status]}
                    </Badge>
                  </TableCell>
                  <TableCell numeric>{user.orderCount}</TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                    {formatDate(user.createdAt)}
                  </TableCell>
                  <TableCell className="whitespace-nowrap text-xs text-foreground-muted">
                    {user.lastLoginAt ? formatDate(user.lastLoginAt) : "Never"}
                  </TableCell>
                  <TableCell>
                    <Button asChild size="sm" variant="ghost">
                      <Link href={`/admin/users/${user.id}`}>Open</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableWrapper>
      )}

      {users.length > 0 ? (
        <Pagination
          page={page}
          totalPages={pageCount}
          totalCount={total}
          pageSize={ADMIN_PAGE_SIZE}
          itemNoun="account"
          buildHref={(target) => hrefFor({ page: target })}
        />
      ) : null}
    </div>
  );
}
