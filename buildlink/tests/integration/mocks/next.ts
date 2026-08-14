import { vi } from "vitest";

/**
 * Replaces only the Next.js request-scope boundary, so server actions and
 * server-side queries can be exercised against a real database from Vitest.
 * Everything below the boundary (validation, guards, Prisma, domain logic) is
 * the real implementation.
 */

vi.mock("next/headers", async () => {
  const context = await import("../helpers/request-context");
  return {
    cookies: async () => context.currentCookies(),
    headers: async () => context.currentHeaders(),
    draftMode: async () => ({ isEnabled: false }),
  };
});

vi.mock("next/cache", () => ({
  revalidatePath: vi.fn(),
  revalidateTag: vi.fn(),
  unstable_noStore: vi.fn(),
}));

vi.mock("next/navigation", async () => {
  const { RedirectError, NotFoundError } = await import("../helpers/request-context");
  return {
    redirect: (destination: string) => {
      throw new RedirectError(destination);
    },
    permanentRedirect: (destination: string) => {
      throw new RedirectError(destination);
    },
    notFound: () => {
      throw new NotFoundError();
    },
  };
});
