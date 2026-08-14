import "server-only";
import { cache } from "react";
import { db } from "@/lib/db";
import type { SessionUser } from "@/lib/auth/session";

/**
 * Data the application shell needs on every authenticated page.
 *
 * Both counts drive badges that must be correct the moment a page renders, so
 * they are read server-side rather than fetched by the client. `cache` keeps it
 * to one round trip per request even though the layout and the top bar both
 * ask for them.
 */

export type ShellCounts = { cart: number; notifications: number };

export const getShellCounts = cache(
  async (user: SessionUser | null): Promise<ShellCounts> => {
    if (!user) return { cart: 0, notifications: 0 };

    const [cartItems, notifications] = await Promise.all([
      db.cartItem.count({
        where: { cart: { userId: user.id, checkedOutAt: null } },
      }),
      db.notification.count({
        where: { userId: user.id, readAt: null, channel: "IN_APP" },
      }),
    ]);

    return { cart: cartItems, notifications };
  },
);
