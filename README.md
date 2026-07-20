# Structured logger

A small, typed structured logger for modern JavaScript runtimes.

## Why

Loosely inspired by Go's `log/slog`, the design follows the child-logger pattern common in structured
logging: create an immutable logger with stable attributes, then attach request or operation details
closer to each call. Types enforce the application's attribute vocabulary, while transports and async
context remain optional so the default entry point stays runtime-neutral.

## Installation

```sh
npm install structured-logger
```

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

> **Sensitive attribute guardrail:** TypeScript rejects the default reserved names (`body`, `header`,
> `headers`, `prompt`, `secret`, and `token`) from extra attributes. The list can be expanded with a
> [custom profile](#custom-profiles), providing a configurable compile-time security check that
> reduces accidental logging of sensitive data. It is not runtime validation or redaction and can be
> bypassed by JavaScript or type casts.

This package performs no runtime validation, serialization, deep cloning, or redaction.

Entries are merged in this order, with later values winning:

1. Ambient ALS context
2. `.with()` attributes
3. Call attributes
4. Fixed base attributes
5. `message`

`.with()` returns a new logger and does not modify its parent.

Call `getContext()` to inspect the attributes available before an individual log call:

```ts
const requestLogger = logger.with({ requestId: "req-1" });

requestLogger.getContext();
// { component: "api", environment: "production", requestId: "req-1" }
```

The returned context uses the same precedence as logging: ambient ALS context, then `.with()`
attributes, then fixed base attributes. It does not include attributes supplied to a later log call,
profile call attributes such as `event`, or `message`. Each invocation returns a new shallow,
readonly snapshot; nested values retain their original references.

## Transports

The default transport calls `console[level](entry)`. Pass a synchronous transport as the optional
second argument:

```ts
import { createLogger, type Transport } from "structured-logger";

const transport: Transport = (level, entry) => {
  console.log(level, entry);
};

const logger = createLogger<AppAttributes>({ component: "api" }, transport);
```

Transport errors propagate. The types reject Promise-returning transports because logger methods
are synchronous. A network transport must enqueue internally and own its delivery and error handling.

Share a transport and attribute vocabulary with a factory:

```ts
import { createLoggerFactory } from "structured-logger";

const logging = createLoggerFactory<AppAttributes>((level, entry) => {
  console.log(level, entry);
});
const apiLogger = logging.createLogger({ component: "api" });
const workerLogger = logging.createLogger({ component: "worker" });
```

## Custom profiles

`LoggerProfile` replaces the fixed base and call attributes while retaining the default sensitive
reserved names:

```ts
import {
  createLogger,
  type DefaultReservedLogAttribute,
  type LoggerProfile,
} from "structured-logger";

type AuditProfile = LoggerProfile<
  { service: string },
  { action: string; failure?: unknown },
  DefaultReservedLogAttribute | "password"
>;

const audit = createLogger<{ actor: string; password: string }, AuditProfile>({
  service: "billing",
});

audit.info("charge created", {
  action: "charge.created",
  actor: "customer-1",
});

// Type error: password is reserved.
audit.with({ password: "secret" });
```

Extra attributes use `LogValue`, the JSON-like value union plus `Date` and `undefined`. Profile
attributes use exactly their declared types. Supply a third `LoggerProfile` type argument only when
the default reserved names need to be extended or explicitly replaced.

## Async context

The `/als` entry point creates loggers backed by `AsyncLocalStorage`. Export a stable logger and
import that same logger wherever its ambient context is needed:

```ts
// logging.ts
import { createLogger } from "structured-logger/als";

export const logger = createLogger<AppAttributes>({ component: "api" });
```

```ts
// request.ts
import { logger } from "./logging.js";

await logger.withLogContext({ requestId: "req-1" }, handleRequest);
```

```ts
// downstream.ts
import { logger } from "./logging.js";

export async function handleRequest() {
  logger.info("handling request"); // includes requestId
}
```

Each root ALS logger owns its context store. Loggers derived from it with `.with()` share that store,
forming one logger lineage. Independent roots remain isolated, including roots created by the same
factory. Nested scopes merge with their parent, nearest values win, and concurrent scopes remain
isolated.

The ALS entry point also exports `createLoggerFactory(transport)` for sharing transport
configuration; every logger it creates still starts an independent lineage.

Each root logger owns its lineage's async context storage. Dispose dynamically created roots after
their contextual work finishes so Node can release that storage:

```ts
const logger = createLogger<AppAttributes>({ component: "job" });

try {
  await logger.withLogContext({ requestId: "req-1" }, handleRequest);
} finally {
  logger.dispose();
}
```

Root loggers also implement `Symbol.dispose`, so explicit resource management is supported:

```ts
{
  using logger = createLogger<AppAttributes>({ component: "job" });
  await logger.withLogContext({ requestId: "req-1" }, handleRequest);
} // Disposes the logger lineage.
```

Loggers derived with `.with()` share their root's storage but do not own or expose its disposal.
Disposal is idempotent, immediately removes ambient context from the entire lineage, and prevents
later `withLogContext()` calls. Explicit logging and `.with()` remain usable without ambient context.
`getContext()` also remains usable and returns `.with()` and fixed base attributes without ambient
context.
Independent roots, including roots created by the same factory, must be disposed independently.

ALS follows asynchronous resources rather than lexical braces. Unawaited promises, timers, or other
work created inside a scope may retain that context after the callback returns. Await all contextual
work before disposing its logger lineage; disposal clears context from work that is still running.

## Entry points

| Import                  | Runtimes                           | Context                            |
| ----------------------- | ---------------------------------- | ---------------------------------- |
| `structured-logger`     | Browsers, workers, Deno, Bun, Node | Explicit `.with()` only            |
| `structured-logger/als` | Node and compatible runtimes       | Logger-lineage `AsyncLocalStorage` |

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
