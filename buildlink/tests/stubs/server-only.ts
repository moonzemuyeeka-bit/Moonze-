/**
 * Stand-in for the `server-only` marker package.
 *
 * Importing the real package outside a React Server Components bundler throws,
 * and its no-op build is not reachable through the package's exports map. Vitest
 * already runs on the server, so both configs alias `server-only` here rather
 * than dropping the guard from the modules that need it in production.
 */
export {};
