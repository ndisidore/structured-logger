import {
  consoleTransport,
  createLoggerWithContext,
  type AnyLoggerTypes,
  type CreateLoggerOptions,
  type DefaultLoggerTypes,
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

const noContext = () => undefined;

export function createLogger<
  Fields extends object = Record<never, never>,
  Types extends AnyLoggerTypes = DefaultLoggerTypes,
>(options: CreateLoggerOptions<Fields, Types>): Logger<Fields, Types> {
  return createLoggerWithContext(options, noContext);
}

export function createLoggerFactory<
  Fields extends object = Record<never, never>,
  Types extends AnyLoggerTypes = DefaultLoggerTypes,
>(options: LoggerFactoryOptions<Fields, Types> = {}): LoggerFactory<Fields, Types> {
  const transport = options.transport ?? (consoleTransport as Transport<LogEntry<Fields, Types>>);
  return {
    createLogger: (loggerOptions) =>
      createLoggerWithContext({ ...loggerOptions, transport }, noContext),
  };
}
