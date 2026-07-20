import {
  createLogger,
  createLoggerFactory,
  type DefaultLoggerProfile,
  type DefaultReservedLogAttribute,
  type LogAttributes,
  type LogEntry,
  type Logger,
  type LoggerContext,
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
const loggerContext: LoggerContext<ExtraAttributes> = logger.getContext();
loggerContext.component.toUpperCase();
loggerContext.requestId?.toUpperCase();
// @ts-expect-error context snapshots are readonly
loggerContext.requestId = "req-2";
// @ts-expect-error per-call profile attributes are not part of logger context
void loggerContext.event;

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
strictLogger.getContext().component.toUpperCase();
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
const auditContext: LoggerContext<{ actor: string }, AuditProfile> = audit.getContext();
auditContext.service.toUpperCase();
auditContext.actor?.toUpperCase();
audit.info("valid", { action: "charge.created", actor: "customer-1" });
// @ts-expect-error custom profiles with required attributes need a second argument
audit.info("missing attributes");
// @ts-expect-error custom attributes are required instead of the default profile attributes
audit.info("missing action", { actor: "customer-1" });
// @ts-expect-error custom profiles retain default reserved attributes
audit.with({ token: "secret" });
// @ts-expect-error custom base attributes are fixed at logger creation
audit.with({ service: "other" });

type ExtendedReservedProfile = LoggerProfile<
  { service: string },
  { action: string },
  DefaultReservedLogAttribute | "password"
>;
const extendedReserved = createLogger<{ password: string }, ExtendedReservedProfile>({
  service: "billing",
});
// @ts-expect-error custom reserved attributes are prohibited
extendedReserved.with({ password: "secret" });

type ReplacedReservedProfile = LoggerProfile<{ service: string }, { action: string }, "credential">;
const replacedReserved = createLogger<
  { credential: string; token: string },
  ReplacedReservedProfile
>({ service: "billing" });
replacedReserved.with({ token: "allowed" });
// @ts-expect-error replacing reserved attributes prohibits the replacement
replacedReserved.with({ credential: "secret" });

type InvalidProfile = LoggerProfile<{ service: string }, { service: number }>;
// @ts-expect-error base and call attributes cannot overlap
createLogger<Record<never, never>, InvalidProfile>({ service: "billing" });

const factory = createLoggerFactory<ExtraAttributes>();
factory.createLogger({ component: "worker" });

const dictionaryLogger = createLogger<Record<string, string>>({ component: "api" });
dictionaryLogger.info("arbitrary attributes remain available", { arbitrary: "value" });
dictionaryLogger.info("profile call attributes remain available", { event: "dictionary.event" });
dictionaryLogger.with({ arbitrary: "value" });
// @ts-expect-error reserved attributes are prohibited with broad string index signatures
dictionaryLogger.info("reserved", { token: "secret" });
// @ts-expect-error message cannot be supplied as an attribute with broad string index signatures
dictionaryLogger.info("message", { message: "replacement" });
// @ts-expect-error fixed base attributes cannot be supplied with broad string index signatures
dictionaryLogger.info("component", { component: "replacement" });
// @ts-expect-error profile call attributes cannot be attached with .with()
dictionaryLogger.with({ event: "dictionary.event" });

const alsLogger = als.createLogger<ExtraAttributes>({ component: "api" });
const alsContext: als.LoggerContext<ExtraAttributes> = alsLogger.getContext();
alsContext.component.toUpperCase();
alsLogger.withLogContext({ requestId: "req-1" }, () => undefined);
const alsChild: als.ContextLogger<ExtraAttributes> = alsLogger.with({ requestId: "req-1" });
// @ts-expect-error factory context is restricted to its declared attributes
alsLogger.withLogContext({ operation: "unknown" }, () => undefined);
// @ts-expect-error reserved attributes cannot enter ambient context
alsLogger.withLogContext({ token: "secret" }, () => undefined);
const misspelledContext = { requestId: "req-1", requsetId: "req-1" };
// @ts-expect-error ALS context rejects additional variable properties
alsLogger.withLogContext(misspelledContext, () => undefined);
const alsFactory = als.createLoggerFactory<ExtraAttributes>();
const factoryLogger: als.ContextLogger<ExtraAttributes> = alsFactory.createLogger({
  component: "worker",
});
const disposableFactoryLogger: als.DisposableContextLogger<ExtraAttributes> =
  alsFactory.createLogger({ component: "disposable-worker" });
const nonOwningChild = disposableFactoryLogger.with({ requestId: "req-1" });
disposableFactoryLogger.dispose();
disposableFactoryLogger[Symbol.dispose]();
{
  using managedLogger = als.createLogger<ExtraAttributes>({ component: "managed-worker" });
  managedLogger.info("managed");
}
// @ts-expect-error derived loggers do not own or expose lineage disposal
nonOwningChild.dispose();
// @ts-expect-error context belongs to returned loggers, not the factory
alsFactory.withLogContext({ requestId: "req-1" }, () => undefined);
const dictionaryAlsLogger = als.createLogger<Record<string, string>>({ component: "api" });
dictionaryAlsLogger.withLogContext({ arbitrary: "value" }, () => undefined);
// @ts-expect-error reserved attributes cannot enter broad ALS context dictionaries
dictionaryAlsLogger.withLogContext({ token: "secret" }, () => undefined);
void alsChild;
void factoryLogger;

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
