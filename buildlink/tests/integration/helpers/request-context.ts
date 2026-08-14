/**
 * A minimal stand-in for the Next.js request scope.
 *
 * Server actions read cookies and headers through `next/headers` and signal
 * navigation by throwing from `redirect()`. Integration tests call those actions
 * directly, so this module provides a per-test cookie jar and header bag, and
 * the mocks in `../mocks/next.ts` wire `next/headers` and `next/navigation` to
 * it. Nothing here is a fake of the code under test — only of the framework
 * boundary.
 */

export type CookieOptions = {
  httpOnly?: boolean;
  secure?: boolean;
  sameSite?: "lax" | "strict" | "none";
  path?: string;
  expires?: Date;
  maxAge?: number;
};

export type StoredCookie = { name: string; value: string; options: CookieOptions };

class CookieJar {
  private readonly cookies = new Map<string, StoredCookie>();

  get(name: string): { name: string; value: string } | undefined {
    const found = this.cookies.get(name);
    return found ? { name: found.name, value: found.value } : undefined;
  }

  getAll(): StoredCookie[] {
    return [...this.cookies.values()];
  }

  set(
    nameOrCookie: string | { name: string; value: string } & CookieOptions,
    value?: string,
    options: CookieOptions = {},
  ): void {
    if (typeof nameOrCookie === "string") {
      this.cookies.set(nameOrCookie, { name: nameOrCookie, value: value ?? "", options });
      return;
    }
    const { name, value: cookieValue, ...rest } = nameOrCookie;
    this.cookies.set(name, { name, value: cookieValue, options: rest });
  }

  delete(name: string): void {
    this.cookies.delete(name);
  }

  has(name: string): boolean {
    return this.cookies.has(name);
  }

  clear(): void {
    this.cookies.clear();
  }
}

/**
 * Navigation signals carry the same `digest` shape the real framework uses, so
 * `isNextControlFlowError` recognises and rethrows them exactly as it does in
 * production instead of reporting a redirect as an internal error.
 */
export class RedirectError extends Error {
  readonly digest: string;

  constructor(readonly destination: string) {
    super(`NEXT_REDIRECT: ${destination}`);
    this.name = "RedirectError";
    this.digest = `NEXT_REDIRECT;replace;${destination};307;`;
  }
}

export class NotFoundError extends Error {
  readonly digest = "NEXT_NOT_FOUND";

  constructor() {
    super("NEXT_NOT_FOUND");
    this.name = "NotFoundError";
  }
}

let cookieJar = new CookieJar();
let requestHeaders = new Headers({
  "user-agent": "BuildLinkIntegrationTests/1.0",
  "x-forwarded-for": "203.0.113.10",
});

export function currentCookies(): CookieJar {
  return cookieJar;
}

export function currentHeaders(): Headers {
  return requestHeaders;
}

/** Called between tests so no session or rate-limit identity leaks across them. */
export function resetRequestContext(options: { ip?: string } = {}): void {
  cookieJar = new CookieJar();
  requestHeaders = new Headers({
    "user-agent": "BuildLinkIntegrationTests/1.0",
    "x-forwarded-for": options.ip ?? "203.0.113.10",
  });
}

export function setRequestIp(ip: string): void {
  requestHeaders.set("x-forwarded-for", ip);
}

/**
 * Runs `fn` and returns the destination a server action redirected to, or null
 * when it returned normally. Any other error propagates.
 */
export async function captureRedirect(fn: () => Promise<unknown>): Promise<string | null> {
  try {
    await fn();
    return null;
  } catch (error) {
    if (error instanceof RedirectError) return error.destination;
    throw error;
  }
}
