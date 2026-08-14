import { NextResponse } from "next/server";
import { db } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth/session";
import { isAdminRole } from "@/lib/auth/permissions";
import { storage, type StorageScope } from "@/lib/services/storage";

/**
 * Serves stored objects.
 *
 * Uploads are written outside `public/` so nothing is served straight off disk.
 * Everything comes back through here, which applies the authorisation the object
 * deserves: a product photo is public, a supplier's tax certificate is not, and
 * proof of delivery belongs to the parties on that order.
 *
 * Keys are always `scope/ownerId/uuid.ext`, generated server-side, so the scope
 * and owner in the path are trustworthy inputs to that decision.
 */

const PUBLIC_SCOPES: readonly StorageScope[] = ["product-images", "supplier-logos"];

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ key: string[] }> },
) {
  const { key: segments } = await params;
  const key = segments.map((segment) => decodeURIComponent(segment)).join("/");

  // Metadata sidecars are an implementation detail of the local driver.
  if (key.includes("..") || key.endsWith(".meta")) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const [scope, ownerId] = segments as [string, string | undefined];
  if (!(await canRead(scope as StorageScope, ownerId ?? null))) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const object = await storage().get(key);
  if (!object) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const isPublic = PUBLIC_SCOPES.includes(scope as StorageScope);
  return new NextResponse(new Uint8Array(object.body), {
    headers: {
      "Content-Type": object.contentType,
      "Content-Length": String(object.body.byteLength),
      "Cache-Control": isPublic
        ? "public, max-age=31536000, immutable"
        : "private, no-store",
      "Content-Disposition": "inline",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

async function canRead(scope: StorageScope, ownerId: string | null): Promise<boolean> {
  if (PUBLIC_SCOPES.includes(scope)) return true;

  const user = await getCurrentUser();
  if (!user) return false;
  if (isAdminRole(user.role)) return true;
  if (!ownerId) return false;

  switch (scope) {
    // A supplier's registration documents are for that supplier and BuildLink.
    case "supplier-documents": {
      const supplier = await db.supplierProfile.findFirst({
        where: { id: ownerId, userId: user.id },
        select: { id: true },
      });
      return supplier !== null;
    }

    // Proof of delivery belongs to the customer, the supplier and the transporter.
    case "delivery-proof": {
      const delivery = await db.delivery.findUnique({
        where: { id: ownerId },
        select: {
          order: { select: { customerId: true, supplier: { select: { userId: true } } } },
          provider: { select: { userId: true } },
        },
      });
      if (!delivery) return false;
      return (
        delivery.order.customerId === user.id ||
        delivery.order.supplier.userId === user.id ||
        delivery.provider?.userId === user.id
      );
    }

    // Project photos, palette uploads and avatars are keyed by their owner's id.
    case "project-images": {
      const project = await db.project.findFirst({
        where: { id: ownerId, customerId: user.id },
        select: { id: true },
      });
      return project !== null;
    }

    case "palette-uploads":
    case "avatars":
      return ownerId === user.id;

    default:
      return false;
  }
}
