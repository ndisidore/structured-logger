import {
  createLogger,
  createLoggerFactory,
  type DefaultLoggerProfile,
  type LogAttributes,
  type LogEntry,
  type Logger,
  type LoggerProfile,
  type Transport,
} from "../src/index.js";
import * as als from "../src/als.js";

type ExtraAttributes = {
  durationMs: number;
  maybeUnsupported: string | Map<string, string>;
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

const logger = createLogger<ExtraAttributes>({ component: "api" });
logger.info("event is optional", { durationMs: 12 });
logger.info("event remains available", { event: "request.handled" });
logger.with({ requestId: "req-1" });
logger.with({ readonlyTags: ["api"] as const });
logger.with({ metadata: { attempt: 1, nested: { ok: true } } });
const unsafeAttributes = { token: "secret" };
const misspelledAttributes = { durationMs: 12, duratonMs: 12 };

// @ts-expect-error unknown attributes are rejected
logger.info("misspelled", { duratonMs: 12 });
// @ts-expect-error declared attributes retain their value types
logger.info("wrong type", { durationMs: "12" });
// @ts-expect-error default reserved attributes remain prohibited
logger.with({ token: "secret" });
// @ts-expect-error reserved attributes remain prohibited through variables
logger.with(unsafeAttributes);
// @ts-expect-error unknown attributes remain prohibited through variables
logger.info("misspelled variable", misspelledAttributes);
// @ts-expect-error extra attribute values must be structured values
logger.with({ unsupported: new Map() });
// @ts-expect-error every member of a value union must be structured
logger.with({ maybeUnsupported: "valid" });

const strictLogger = createLogger({ component: "api" });
strictLogger.info("valid");
// @ts-expect-error undeclared attributes are rejected without a generic
strictLogger.with({ requestId: "req-1" });
// @ts-expect-error undeclared call attributes are rejected without a generic
strictLogger.info("invalid", { requestId: "req-1" });
const unsafeBase = { component: "api", token: "secret" };
// @ts-expect-error default base attributes reject additional variable properties
createLogger(unsafeBase);

// @ts-expect-error profiles require explicit base and call attribute types
export type IncompleteProfile = LoggerProfile<{ service: string }>;

type AuditProfile = LoggerProfile<{ service: string }, { action: string; failure?: unknown }>;
const audit = createLogger<{ actor: string; token: string }, AuditProfile>({ service: "billing" });
audit.info("valid", { action: "charge.created", actor: "customer-1" });
// @ts-expect-error custom profiles with required attributes need a second argument
audit.info("missing attributes");
// @ts-expect-error custom attributes are required instead of the default profile attributes
audit.info("missing action", { actor: "customer-1" });
// @ts-expect-error custom profiles retain default reserved attributes
audit.with({ token: "secret" });
// @ts-expect-error custom base attributes are fixed at logger creation
audit.with({ service: "other" });

type InvalidProfile = LoggerProfile<{ service: string }, { service: number }>;
// @ts-expect-error base and call attributes cannot overlap
createLogger<Record<never, never>, InvalidProfile>({ service: "billing" });

const factory = createLoggerFactory<ExtraAttributes>();
factory.createLogger({ component: "worker" });

const alsLogging = als.createLoggerFactory<ExtraAttributes>();
alsLogging.withLogContext({ requestId: "req-1" }, () => undefined);
// @ts-expect-error factory context is restricted to its declared attributes
alsLogging.withLogContext({ operation: "unknown" }, () => undefined);
// @ts-expect-error reserved attributes cannot enter ambient context
alsLogging.withLogContext({ token: "secret" }, () => undefined);
const misspelledContext = { requestId: "req-1", requsetId: "req-1" };
// @ts-expect-error ALS context rejects additional variable properties
alsLogging.withLogContext(misspelledContext, () => undefined);
// @ts-expect-error ALS exposes no direct logger creation
export type AlsCreateLogger = typeof als.createLogger;
// @ts-expect-error ALS exposes no module-global context helper
export type AlsWithLogContext = typeof als.withLogContext;

const syncTransport: Transport = () => undefined;
createLogger({ component: "api" }, syncTransport);
function voidTransport(): void {}
createLogger({ component: "api" }, voidTransport);
// @ts-expect-error async transports are not supported
createLogger({ component: "api" }, async () => undefined);

const acceptsLogger = (_logger: Logger<ExtraAttributes>) => undefined;
const acceptsEntry = (_entry: LogEntry<ExtraAttributes>) => undefined;
const acceptsAttributes = (_attributes: LogAttributes<ExtraAttributes>) => undefined;
const defaultProfile: DefaultLoggerProfile = {} as DefaultLoggerProfile;
acceptsLogger(logger);
acceptsEntry({ component: "api", message: "message" });
acceptsAttributes({});
void defaultProfile;
