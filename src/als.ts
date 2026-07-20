import { AsyncLocalStorage } from "node:async_hooks";
import {
  consoleTransport,
  createLoggerWithContext,
  type AnyLoggerProfile,
  type DefaultLoggerProfile,
  type LogContext,
  type LogEntry,
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

export interface ContextLoggerFactory<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile,
> extends LoggerFactory<ExtraAttributes, Profile> {
  withLogContext<Attributes extends LogContext<ExtraAttributes, Profile>, Result>(
    attributes: Attributes &
      Record<Exclude<keyof Attributes, keyof LogContext<ExtraAttributes, Profile>>, never>,
    callback: () => Result,
  ): Result;
}

export function createLoggerFactory<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
>(
  transport: Transport<LogEntry<ExtraAttributes, Profile>> = consoleTransport,
): ContextLoggerFactory<ExtraAttributes, Profile> {
  const storage = new AsyncLocalStorage<Readonly<object>>();
  return {
    createLogger: (base) => createLoggerWithContext(base, transport, () => storage.getStore()),
    withLogContext: (attributes, callback) =>
      storage.run({ ...storage.getStore(), ...attributes }, callback),
  };
}
