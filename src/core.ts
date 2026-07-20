export type LogLevel = "debug" | "info" | "warn" | "error";

export type LogValue =
  | string
  | number
  | boolean
  | Date
  | null
  | undefined
  | { readonly [key: string]: LogValue }
  | readonly LogValue[];

export type LoggerTypes<
  Base extends object = object,
  Details extends object = object,
  Reserved extends PropertyKey = never,
> = {
  base: Base;
  details: Details;
  reserved: Reserved;
};

export type AnyLoggerTypes = LoggerTypes<object, object, PropertyKey>;

export type DefaultReservedLogField =
  | "body"
  | "component"
  | "error"
  | "errorStack"
  | "event"
  | "header"
  | "headers"
  | "message"
  | "prompt"
  | "secret"
  | "token";

export type DefaultLoggerTypes = LoggerTypes<
  { component: string },
  { event: string; error?: unknown },
  DefaultReservedLogField
>;

type ProfileKeys<Types extends AnyLoggerTypes> =
  | Types["reserved"]
  | keyof Types["base"]
  | keyof Types["details"]
  | "message";

type IsLogValue<Value> = Value extends string | number | boolean | Date | null | undefined
  ? true
  : Value extends (...args: never[]) => unknown
    ? false
    : Value extends readonly (infer Item)[]
      ? IsLogValue<Item>
      : Value extends object
        ? false extends { [Key in keyof Value]-?: IsLogValue<Value[Key]> }[keyof Value]
          ? false
          : true
        : false;

type SafeFields<Fields extends object, Types extends AnyLoggerTypes> = {
  [Key in keyof Fields as Key extends ProfileKeys<Types> ? never : Key]: true extends IsLogValue<
    Fields[Key]
  >
    ? Fields[Key]
    : never;
};

export type LoggerFields<Fields extends object, Types extends AnyLoggerTypes> = SafeFields<
  Fields,
  Types
> & {
  [Key in Extract<keyof Fields, ProfileKeys<Types>>]?: never;
};

export type LogDetails<Fields extends object, Types extends AnyLoggerTypes> = Readonly<
  Types["details"] & Partial<LoggerFields<Fields, Types>>
>;

export type LogEntry<Fields extends object, Types extends AnyLoggerTypes> = Readonly<
  Omit<
    Partial<SafeFields<Fields, Types>>,
    keyof Types["details"] | keyof Types["base"] | "message"
  > &
    Omit<Types["details"], keyof Types["base"] | "message"> &
    Types["base"] & { message: string }
>;

export type Transport<Entry extends object = object> = (
  level: LogLevel,
  entry: Readonly<Entry>,
) => void;

export type CreateLoggerOptions<Fields extends object, Types extends AnyLoggerTypes> = Readonly<{
  base: Readonly<Types["base"]>;
  fields?: Readonly<Partial<LoggerFields<Fields, Types>>>;
  transport?: Transport<LogEntry<Fields, Types>>;
}>;

export interface Logger<Fields extends object, Types extends AnyLoggerTypes> {
  with(fields: Readonly<Partial<LoggerFields<Fields, Types>>>): Logger<Fields, Types>;
  debug(message: string, details: LogDetails<Fields, Types>): void;
  info(message: string, details: LogDetails<Fields, Types>): void;
  warn(message: string, details: LogDetails<Fields, Types>): void;
  error(message: string, details: LogDetails<Fields, Types>): void;
}

export interface LoggerFactory<Fields extends object, Types extends AnyLoggerTypes> {
  createLogger(
    options: Omit<CreateLoggerOptions<Fields, Types>, "transport">,
  ): Logger<Fields, Types>;
}

export type LoggerFactoryOptions<Fields extends object, Types extends AnyLoggerTypes> = Readonly<{
  transport?: Transport<LogEntry<Fields, Types>>;
}>;

export type LogContext<Fields extends object, Types extends AnyLoggerTypes> = Readonly<
  Partial<LoggerFields<Fields, Types>>
>;

export type InferredLogContext<Fields extends object, Types extends AnyLoggerTypes> = Readonly<{
  [Key in keyof Fields]: Key extends ProfileKeys<Types>
    ? never
    : true extends IsLogValue<Fields[Key]>
      ? Fields[Key]
      : never;
}>;

type ContextReader = () => Readonly<object> | undefined;

export const consoleTransport: Transport = (level, entry) => console[level](entry);

class StructuredLogger<Fields extends object, Types extends AnyLoggerTypes> implements Logger<
  Fields,
  Types
> {
  readonly #base: Readonly<Types["base"]>;
  readonly #fields: Readonly<Partial<LoggerFields<Fields, Types>>>;
  readonly #readContext: ContextReader;
  readonly #transport: Transport<LogEntry<Fields, Types>>;

  constructor(
    base: Readonly<Types["base"]>,
    fields: Readonly<Partial<LoggerFields<Fields, Types>>>,
    transport: Transport<LogEntry<Fields, Types>>,
    readContext: ContextReader,
  ) {
    this.#base = { ...base };
    this.#fields = { ...fields };
    this.#transport = transport;
    this.#readContext = readContext;
  }

  with(fields: Readonly<Partial<LoggerFields<Fields, Types>>>): Logger<Fields, Types> {
    return new StructuredLogger(
      this.#base,
      { ...this.#fields, ...fields },
      this.#transport,
      this.#readContext,
    );
  }

  debug(message: string, details: LogDetails<Fields, Types>): void {
    this.#write("debug", message, details);
  }

  info(message: string, details: LogDetails<Fields, Types>): void {
    this.#write("info", message, details);
  }

  warn(message: string, details: LogDetails<Fields, Types>): void {
    this.#write("warn", message, details);
  }

  error(message: string, details: LogDetails<Fields, Types>): void {
    this.#write("error", message, details);
  }

  #write(level: LogLevel, message: string, details: LogDetails<Fields, Types>): void {
    const entry = {
      ...this.#readContext(),
      ...this.#fields,
      ...details,
      ...this.#base,
      message,
    } as LogEntry<Fields, Types>;
    this.#transport(level, entry);
  }
}

export function createLoggerWithContext<Fields extends object, Types extends AnyLoggerTypes>(
  options: CreateLoggerOptions<Fields, Types>,
  readContext: ContextReader,
): Logger<Fields, Types> {
  return new StructuredLogger(
    options.base,
    options.fields ?? ({} as Partial<LoggerFields<Fields, Types>>),
    options.transport ?? (consoleTransport as Transport<LogEntry<Fields, Types>>),
    readContext,
  );
}
