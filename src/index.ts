import {
  consoleTransport,
  createLoggerWithContext,
  type AnyLoggerProfile,
  type DefaultLoggerProfile,
  type Exact,
  type LogEntry,
  type Logger,
  type LoggerBase,
  type LoggerFactory,
  type NoExtraAttributes,
  type Transport,
} from "./core.js";

export type {
  DefaultLoggerProfile,
  DefaultReservedLogAttribute,
  LogAttributes,
  LogContext,
  LogEntry,
  LogLevel,
  Logger,
  LoggerAttributes,
  LoggerBase,
  LoggerContext,
  LoggerFactory,
  LoggerProfile,
  LogValue,
  Transport,
} from "./core.js";
export { consoleTransport } from "./core.js";

const noContext = () => undefined;

/** Creates an immutable structured logger with explicit attributes and no ambient async context. */
export function createLogger<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
  Base extends LoggerBase<Profile> = LoggerBase<Profile>,
>(
  base: Exact<Base, LoggerBase<Profile>>,
  transport: Transport<LogEntry<ExtraAttributes, Profile>> = consoleTransport,
): Logger<ExtraAttributes, Profile> {
  return createLoggerWithContext(base, transport, noContext);
}

/** Creates loggers that share a transport and attribute profile. */
export function createLoggerFactory<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
>(
  transport: Transport<LogEntry<ExtraAttributes, Profile>> = consoleTransport,
): LoggerFactory<ExtraAttributes, Profile> {
  return {
    createLogger: (base) => createLoggerWithContext(base, transport, noContext),
  };
}
