import { createLogger, createLoggerFactory, type LoggerTypes } from "../src/index.js";
import {
  createLogger as createNodeLogger,
  createLoggerFactory as createNodeLoggerFactory,
  withLogContext,
} from "../src/als.js";

type Fields = {
  durationMs: number;
  metadata: Metadata;
  readonlyTags: readonly string[];
  requestId: string;
  token: string;
  unsupported: Map<string, string>;
};

interface Metadata {
  attempt: number;
  nested: { ok: boolean };
}

const logger = createLogger<Fields>({ base: { component: "api" } });
logger.info("valid", { event: "request.handled", durationMs: 12 });
logger.with({ requestId: "req-1" });
logger.with({ readonlyTags: ["api"] as const });
logger.with({ metadata: { attempt: 1, nested: { ok: true } } });

// @ts-expect-error event is required by the default profile
logger.info("missing event", { durationMs: 12 });
// @ts-expect-error unknown fields are rejected
logger.info("misspelled", { event: "request.handled", duratonMs: 12 });
// @ts-expect-error declared fields retain their value types
logger.info("wrong type", { event: "request.handled", durationMs: "12" });
// @ts-expect-error default reserved fields remain prohibited
logger.with({ token: "secret" });
// @ts-expect-error extra field values must belong to LogValue
logger.with({ unsupported: new Map() });

type AuditTypes = LoggerTypes<
  { service: string },
  { action: string; failure?: unknown },
  "password"
>;
const audit = createLogger<{ actor: string; password: string }, AuditTypes>({
  base: { service: "billing" },
});
audit.info("valid", { action: "charge.created", actor: "customer-1" });
// @ts-expect-error custom details are required instead of the default event
audit.info("missing action", { actor: "customer-1" });
// @ts-expect-error custom reserved fields are prohibited
audit.with({ password: "secret" });
// @ts-expect-error custom base fields are fixed at logger creation
audit.with({ service: "other" });

const factory = createLoggerFactory<Fields>();
factory.createLogger({ base: { component: "worker" } });

const nodeLogging = createNodeLoggerFactory<Fields>();
nodeLogging.withLogContext({ requestId: "req-1" }, () => undefined);
withLogContext({ requestId: "req-1" }, () => undefined);
// @ts-expect-error factory context is restricted to its declared fields
nodeLogging.withLogContext({ operation: "unknown" }, () => undefined);
// @ts-expect-error reserved fields cannot enter ambient context
nodeLogging.withLogContext({ token: "secret" }, () => undefined);
// @ts-expect-error reserved fields cannot enter module-global context
withLogContext({ token: "secret" }, () => undefined);

// @ts-expect-error module-global ALS context only supports the default profile
createNodeLogger<Fields, AuditTypes>({ base: { service: "billing" } });
