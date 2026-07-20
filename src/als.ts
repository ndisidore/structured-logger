import { AsyncLocalStorage } from "node:async_hooks";
import {
  consoleTransport,
  createLoggerWithContext,
  type AnyLoggerProfile,
  type DefaultLoggerProfile,
  type Exact,
  type LogContext,
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
  LoggerFactory,
  LoggerProfile,
  LogValue,
  Transport,
} from "./core.js";
export { consoleTransport } from "./core.js";

export interface ContextLogger<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> extends Logger<ExtraAttributes, Profile> {
  with<Attributes extends LogContext<ExtraAttributes, Profile>>(
    attributes: Exact<Attributes, LogContext<ExtraAttributes, Profile>>,
  ): ContextLogger<ExtraAttributes, Profile>;
  withLogContext<Attributes extends LogContext<ExtraAttributes, Profile>, Result>(
    attributes: Exact<Attributes, LogContext<ExtraAttributes, Profile>>,
    callback: () => Result,
  ): Result;
}

export interface ContextLoggerFactory<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> extends LoggerFactory<ExtraAttributes, Profile> {
  createLogger<Base extends LoggerBase<Profile>>(
    base: Exact<Base, LoggerBase<Profile>>,
  ): ContextLogger<ExtraAttributes, Profile>;
}

function withContext<ExtraAttributes extends object, Profile extends AnyLoggerProfile>(
  logger: Logger<ExtraAttributes, Profile>,
  storage: AsyncLocalStorage<Readonly<object>>,
): ContextLogger<ExtraAttributes, Profile> {
  return {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    with: (attributes) => withContext(logger.with(attributes), storage),
    withLogContext: (attributes, callback) =>
      storage.run({ ...storage.getStore(), ...attributes }, callback),
  };
}

export function createLogger<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
  Base extends LoggerBase<Profile> = LoggerBase<Profile>,
>(
  base: Exact<Base, LoggerBase<Profile>>,
  transport: Transport<LogEntry<ExtraAttributes, Profile>> = consoleTransport,
): ContextLogger<ExtraAttributes, Profile> {
  const storage = new AsyncLocalStorage<Readonly<object>>();
  return withContext(
    createLoggerWithContext(base, transport, () => storage.getStore()),
    storage,
  );
}

export function createLoggerFactory<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
>(
  transport: Transport<LogEntry<ExtraAttributes, Profile>> = consoleTransport,
): ContextLoggerFactory<ExtraAttributes, Profile> {
  return {
    createLogger: (base) => createLogger(base, transport),
  };
}
