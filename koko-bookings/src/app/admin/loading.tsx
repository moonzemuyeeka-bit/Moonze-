import { LoadingRow, Skeleton, SkeletonGrid } from "@/components/ui/skeleton";

/** Shown while an admin page fetches its data on the server. */
export default function AdminLoading() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-full max-w-md" />
      </div>
      <LoadingRow label="Loading your business data…" />
      <SkeletonGrid count={4} className="sm:grid-cols-2 lg:grid-cols-4" itemClassName="h-28" />
      <Skeleton className="h-64" />
    </div>
  );
}
