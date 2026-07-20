import { AsyncLocalStorage } from "node:async_hooks";
import {
  consoleTransport,
  createLoggerWithContext,
  type AnyLoggerTypes,
  type CreateLoggerOptions,
  type DefaultLoggerTypes,
  type InferredLogContext,
  type LogContext,
  type LogEntry,
  type Logger,
  type LoggerFactory,
  type LoggerFactoryOptions,
  type Transport,
} from "./core.js";

export type {
  CreateLoggerOptions,
  DefaultLoggerTypes,
  DefaultReservedLogField,
  InferredLogContext,
  LogContext,
  LogDetails,
  LogEntry,
  LogLevel,
  Logger,
  LoggerFactory,
  LoggerFactoryOptions,
  LoggerFields,
  LoggerTypes,
  LogValue,
  Transport,
} from "./core.js";
export { consoleTransport } from "./core.js";

export interface ContextLoggerFactory<
  Fields extends object,
  Types extends AnyLoggerTypes,
> extends LoggerFactory<Fields, Types> {
  withLogContext<Result>(fields: LogContext<Fields, Types>, callback: () => Result): Result;
}

const context = new AsyncLocalStorage<Readonly<object>>();

export function withLogContext<Fields extends object, Result>(
  fields: InferredLogContext<Fields, DefaultLoggerTypes>,
  callback: () => Result,
): Result {
  return context.run({ ...context.getStore(), ...fields }, callback);
}

export function createLogger<Fields extends object = Record<never, never>>(
  options: CreateLoggerOptions<Fields, DefaultLoggerTypes>,
): Logger<Fields, DefaultLoggerTypes> {
  return createLoggerWithContext(options, () => context.getStore());
}

export function createLoggerFactory<
  Fields extends object = Record<never, never>,
  Types extends AnyLoggerTypes = DefaultLoggerTypes,
>(options: LoggerFactoryOptions<Fields, Types> = {}): ContextLoggerFactory<Fields, Types> {
  const storage = new AsyncLocalStorage<Readonly<object>>();
  const transport = options.transport ?? (consoleTransport as Transport<LogEntry<Fields, Types>>);
  return {
    createLogger: (loggerOptions) =>
      createLoggerWithContext({ ...loggerOptions, transport }, () => storage.getStore()),
    withLogContext: (fields, callback) =>
      storage.run({ ...storage.getStore(), ...fields }, callback),
  };
}
