# Structured logger

A small, typed structured logger for modern JavaScript runtimes.

## Usage

```ts
import { createLogger } from "structured-logger";

type AppAttributes = {
  durationMs: number;
  environment: string;
  requestId: string;
};

const logger = createLogger<AppAttributes>({ component: "api" }).with({
  environment: "production",
});

logger.with({ requestId: "req-1" }).info("request handled", {
  durationMs: 12,
  event: "request.handled",
});
```

The default profile fixes `component` when creating a logger and accepts optional `event` and
`error` call attributes. The attributes argument may be omitted when no attributes are needed.
Values, including errors, pass through unchanged.

Profiles and reserved names are compile-time guardrails. This package performs no runtime
validation, serialization, deep cloning, or redaction.

Entries are merged in this order, with later values winning:

1. Ambient ALS context
2. `.with()` attributes
3. Call attributes
4. Fixed base attributes
5. `message`

`.with()` returns a new logger and does not modify its parent.

## Transports

The default transport calls `console[level](entry)`. Pass a synchronous transport as the optional
second argument:

```ts
const logger = createLogger<AppAttributes>({ component: "api" }, (level, entry) => {
  write(level, entry);
});
```

Transport errors propagate. Promise-returning transports are rejected because logger methods are
synchronous. A network transport must enqueue internally and own its delivery and error handling.

Share a transport and attribute vocabulary with a factory:

```ts
import { createLoggerFactory } from "structured-logger";

const logging = createLoggerFactory<AppAttributes>(transport);
const apiLogger = logging.createLogger({ component: "api" });
const workerLogger = logging.createLogger({ component: "worker" });
```

## Custom profiles

`LoggerProfile` replaces the fixed base and call attributes while retaining the default sensitive
reserved names:

```ts
import { createLogger, type LoggerProfile } from "structured-logger";

type AuditProfile = LoggerProfile<{ service: string }, { action: string; failure?: unknown }>;

const audit = createLogger<{ actor: string }, AuditProfile>({
  service: "billing",
});

audit.info("charge created", {
  action: "charge.created",
  actor: "customer-1",
});
```

Extra attributes use `LogValue`, the JSON-like value union plus `Date` and `undefined`. Profile
attributes use exactly their declared types. Supply a third `LoggerProfile` type argument only when
the default reserved names need to be extended or explicitly replaced.

## Async context

The `/als` entry point exposes an isolated factory backed by `AsyncLocalStorage`:

```ts
import { createLoggerFactory } from "structured-logger/als";

const logging = createLoggerFactory<AppAttributes>(transport);
const logger = logging.createLogger({ component: "api" });

await logging.withLogContext({ requestId: "req-1" }, async () => {
  await handleRequest(logger);
});
```

Each factory owns its context store. Nested scopes inherit their parent's attributes, concurrent
scopes remain isolated, and context does not affect loggers created from the root entry point.

## Entry points

| Import                  | Runtimes                           | Context                            |
| ----------------------- | ---------------------------------- | ---------------------------------- |
| `structured-logger`     | Browsers, workers, Deno, Bun, Node | Explicit `.with()` only            |
| `structured-logger/als` | Node and compatible runtimes       | Factory-scoped `AsyncLocalStorage` |

Only the `/als` entry point imports `node:async_hooks`. Cloudflare Workers must enable `nodejs_als`
or `nodejs_compat` to use it. A Worker transport that starts asynchronous delivery must register its
own promise with `waitUntil` or enqueue synchronously before returning.

Browser consoles may inspect logged objects lazily and format them differently. Treat the console
transport as diagnostics rather than durable ingestion.

## Development

```sh
pnpm install
pnpm check
```

Target: ES2023. Runtime dependencies: none. License: MIT.
