# Structured logger

A small, typed structured logger for modern JavaScript runtimes.

> The npm name is temporary and publishing is disabled until a permanent package name is chosen.

## Usage

```ts
import { createLogger } from "<package-name>";

type Fields = {
  durationMs: number;
  requestId: string;
};

const logger = createLogger<Fields>({
  base: { component: "api" },
});

logger.with({ requestId: "req-1" }).info("request handled", {
  event: "request.handled",
  durationMs: 12,
});
```

The default profile requires a `component` when creating a logger and an `event` on every entry. It
also accepts an optional `error`. Values, including errors, are passed through unchanged.

Entries are merged in this order, with later values winning:

1. Ambient ALS context
2. Initial and `.with()` fields
3. Call details
4. Fixed base fields
5. `message`

`.with()` returns a new logger and does not modify its parent.

## Transports

The default transport calls `console[level](entry)`. Supply a synchronous function per logger:

```ts
const logger = createLogger<Fields>({
  base: { component: "api" },
  transport: (level, entry) => write(level, entry),
});
```

Or share one with a factory:

```ts
import { createLoggerFactory } from "<package-name>";

const logging = createLoggerFactory<Fields>({ transport });
const logger = logging.createLogger({ base: { component: "api" } });
```

Transport errors propagate. A transport that must not interrupt application code can handle its own
errors. Network transports must enqueue internally because logger methods are synchronous.

## Custom types

`LoggerTypes` replaces the default base, detail, and reserved field types without runtime schemas:

```ts
import { createLogger, type LoggerTypes } from "<package-name>";

type AuditTypes = LoggerTypes<
  { service: string },
  { action: string; failure?: unknown },
  "password" | "token"
>;

const audit = createLogger<{ actor: string }, AuditTypes>({
  base: { service: "billing" },
});

audit.info("charge created", {
  action: "charge.created",
  actor: "customer-1",
});
```

Additional fields use `LogValue`, the default JSON-like value union plus `Date` and `undefined`.
Profile fields use exactly the types declared by the profile.

## Async context

The optional ALS entry point propagates fields with `AsyncLocalStorage`:

```ts
import { createLoggerFactory } from "<package-name>/als";

const logging = createLoggerFactory<Fields>();
const logger = logging.createLogger({ base: { component: "api" } });

await logging.withLogContext({ requestId: "req-1" }, async () => {
  await handleRequest(logger);
});
```

Factories own isolated context stores and support custom profiles. The direct `createLogger` and
`withLogContext` exports share a module-level store for compatibility with independently created
default-profile loggers.

## Browsers and Workers

The root export uses standard JavaScript and supports modern browsers, web workers, service workers,
Cloudflare Workers, Deno, Bun, and modern Node. Only `<package-name>/als` imports
`node:async_hooks`; Cloudflare Workers must enable `nodejs_als` or `nodejs_compat` to use it.

Browser consoles may inspect logged objects lazily and format them differently. Treat the console
transport as diagnostics, not durable ingestion. Browser ambient context is not provided because
JavaScript `AsyncContext` is not yet broadly available; pass fields with `.with()` instead.

## Development

```sh
pnpm install
pnpm check
```

Target: ES2023. Runtime dependencies: none. License: MIT.
