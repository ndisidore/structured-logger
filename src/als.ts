/// <reference lib="esnext.disposable" preserve="true" />

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
  /** Returns a new logger with attributes attached while retaining this logger's context store. */
  with<Attributes extends LogContext<ExtraAttributes, Profile>>(
    attributes: Exact<Attributes, LogContext<ExtraAttributes, Profile>>,
  ): ContextLogger<ExtraAttributes, Profile>;
  /** Runs a callback with ambient attributes available to this logger lineage. */
  withLogContext<Attributes extends LogContext<ExtraAttributes, Profile>, Result>(
    attributes: Exact<Attributes, LogContext<ExtraAttributes, Profile>>,
    callback: () => Result,
  ): Result;
}

/** Owns the async context storage shared by a context logger lineage. */
export interface DisposableContextLogger<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
>
  extends ContextLogger<ExtraAttributes, Profile>, Disposable {
  /** Permanently disables ambient context for this logger lineage. */
  dispose(): void;
  /** Permanently disables ambient context for this logger lineage. */
  [Symbol.dispose](): void;
}

export interface ContextLoggerFactory<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> extends LoggerFactory<ExtraAttributes, Profile> {
  /** Creates a context-aware logger with an independent context store. */
  createLogger<Base extends LoggerBase<Profile>>(
    base: Exact<Base, LoggerBase<Profile>>,
  ): DisposableContextLogger<ExtraAttributes, Profile>;
}

type ContextLineage = {
  disposed: boolean;
  storage: AsyncLocalStorage<Readonly<object>>;
};

function withContext<ExtraAttributes extends object, Profile extends AnyLoggerProfile>(
  logger: Logger<ExtraAttributes, Profile>,
  lineage: ContextLineage,
): ContextLogger<ExtraAttributes, Profile> {
  return {
    debug: logger.debug.bind(logger),
    info: logger.info.bind(logger),
    warn: logger.warn.bind(logger),
    error: logger.error.bind(logger),
    with: (attributes) => withContext(logger.with(attributes), lineage),
    withLogContext: (attributes, callback) => {
      if (lineage.disposed) {
        throw new Error("Logger context has been disposed");
      }
      return lineage.storage.run({ ...lineage.storage.getStore(), ...attributes }, callback);
    },
  };
}

/** Creates a structured logger backed by an independent `AsyncLocalStorage` context. */
export function createLogger<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
  Base extends LoggerBase<Profile> = LoggerBase<Profile>,
>(
  base: Exact<Base, LoggerBase<Profile>>,
  transport: Transport<LogEntry<ExtraAttributes, Profile>> = consoleTransport,
): DisposableContextLogger<ExtraAttributes, Profile> {
  const storage = new AsyncLocalStorage<Readonly<object>>();
  const lineage: ContextLineage = { disposed: false, storage };
  const logger = withContext<ExtraAttributes, Profile>(
    createLoggerWithContext<ExtraAttributes, Profile>(base, transport, () => storage.getStore()),
    lineage,
  );
  const dispose = () => {
    if (lineage.disposed) return;
    lineage.disposed = true;
    storage.disable();
  };
  return { ...logger, dispose, [Symbol.dispose]: dispose };
}

/** Creates context-aware loggers that share a transport but keep independent context stores. */
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
