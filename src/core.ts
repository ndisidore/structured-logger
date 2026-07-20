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

export type DefaultReservedLogAttribute =
  | "body"
  | "header"
  | "headers"
  | "prompt"
  | "secret"
  | "token";

export type LoggerProfile<
  Base extends object,
  Attributes extends object,
  Reserved extends PropertyKey = DefaultReservedLogAttribute,
> = {
  base: Base;
  attributes: Attributes;
  reserved: Reserved;
};

export type AnyLoggerProfile = LoggerProfile<object, object, PropertyKey>;

export type Exact<Actual, Allowed> = Actual & Record<Exclude<keyof Actual, keyof Allowed>, never>;

export type DefaultLoggerProfile = LoggerProfile<
  { component: string },
  { event?: string; error?: unknown }
>;

declare const noExtraAttributes: unique symbol;
export type NoExtraAttributes = { readonly [noExtraAttributes]: never };

type ProfileKeys<Profile extends AnyLoggerProfile> =
  | Profile["reserved"]
  | keyof Profile["base"]
  | keyof Profile["attributes"]
  | "message";

type ProfileConflict<Profile extends AnyLoggerProfile> =
  | Extract<keyof Profile["base"], keyof Profile["attributes"] | "message">
  | Extract<keyof Profile["attributes"], "message">;

type IsLogValue<Value> = Value extends string | number | boolean | Date | null | undefined
  ? true
  : Value extends CallableFunction
    ? false
    : Value extends readonly (infer Item)[]
      ? IsLogValue<Item>
      : Value extends object
        ? false extends { [Key in keyof Value]-?: IsLogValue<Value[Key]> }[keyof Value]
          ? false
          : true
        : false;

type SafeAttributes<ExtraAttributes extends object, Profile extends AnyLoggerProfile> = {
  [Key in keyof ExtraAttributes as Key extends ProfileKeys<Profile>
    ? never
    : Key]: false extends IsLogValue<ExtraAttributes[Key]> ? never : ExtraAttributes[Key];
};

export type LoggerAttributes<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> = SafeAttributes<ExtraAttributes, Profile> & {
  [Key in Extract<keyof ExtraAttributes, ProfileKeys<Profile>>]?: never;
};

type AttachedAttributes<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile,
> = ExtraAttributes extends NoExtraAttributes
  ? Readonly<Record<string, never>>
  : Readonly<Partial<LoggerAttributes<ExtraAttributes, Profile>>>;

export type LogAttributes<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> = ExtraAttributes extends NoExtraAttributes
  ? Readonly<Profile["attributes"]>
  : Readonly<Profile["attributes"] & Partial<LoggerAttributes<ExtraAttributes, Profile>>>;

export type LogEntry<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> = Readonly<
  Omit<
    Partial<SafeAttributes<ExtraAttributes, Profile>>,
    keyof Profile["attributes"] | keyof Profile["base"] | "message"
  > &
    Omit<Profile["attributes"], keyof Profile["base"] | "message"> &
    Profile["base"] & { message: string }
>;

type LogMethodArguments<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile,
  Attributes extends LogAttributes<ExtraAttributes, Profile>,
> =
  object extends LogAttributes<ExtraAttributes, Profile>
    ? [attributes?: Exact<Attributes, LogAttributes<ExtraAttributes, Profile>>]
    : [attributes: Exact<Attributes, LogAttributes<ExtraAttributes, Profile>>];

type LogMethod<ExtraAttributes extends object, Profile extends AnyLoggerProfile> = <
  Attributes extends LogAttributes<ExtraAttributes, Profile> = LogAttributes<
    ExtraAttributes,
    Profile
  >,
>(
  message: string,
  ...args: LogMethodArguments<ExtraAttributes, Profile, Attributes>
) => void;

/** Receives each completed log entry synchronously. */
export type Transport<Entry extends object = object> = (
  level: LogLevel,
  entry: Readonly<Entry>,
) => void | undefined;

export type LoggerBase<Profile extends AnyLoggerProfile = DefaultLoggerProfile> = [
  ProfileConflict<Profile>,
] extends [never]
  ? Readonly<Profile["base"]>
  : never;

export interface Logger<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> {
  /** Returns a new logger with attributes attached to every entry. */
  with<Attributes extends AttachedAttributes<ExtraAttributes, Profile>>(
    attributes: Exact<Attributes, AttachedAttributes<ExtraAttributes, Profile>>,
  ): Logger<ExtraAttributes, Profile>;
  /** Writes a debug-level entry. */
  debug: LogMethod<ExtraAttributes, Profile>;
  /** Writes an info-level entry. */
  info: LogMethod<ExtraAttributes, Profile>;
  /** Writes a warning-level entry. */
  warn: LogMethod<ExtraAttributes, Profile>;
  /** Writes an error-level entry. */
  error: LogMethod<ExtraAttributes, Profile>;
}

export interface LoggerFactory<
  ExtraAttributes extends object = NoExtraAttributes,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> {
  /** Creates a logger using this factory's transport and attribute profile. */
  createLogger<Base extends LoggerBase<Profile>>(
    base: Exact<Base, LoggerBase<Profile>>,
  ): Logger<ExtraAttributes, Profile>;
}

export type LogContext<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile = DefaultLoggerProfile,
> = AttachedAttributes<ExtraAttributes, Profile>;

type ContextReader = () => Readonly<object> | undefined;

/** Writes each entry to the console method matching its log level. */
export const consoleTransport: Transport = (level, entry) => {
  console[level](entry);
};

class StructuredLogger<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile,
> implements Logger<ExtraAttributes, Profile> {
  readonly #base: LoggerBase<Profile>;
  readonly #attributes: AttachedAttributes<ExtraAttributes, Profile>;
  readonly #readContext: ContextReader;
  readonly #transport: Transport<LogEntry<ExtraAttributes, Profile>>;

  constructor(
    base: LoggerBase<Profile>,
    attributes: AttachedAttributes<ExtraAttributes, Profile>,
    transport: Transport<LogEntry<ExtraAttributes, Profile>>,
    readContext: ContextReader,
  ) {
    this.#base = { ...base };
    this.#attributes = { ...attributes } as AttachedAttributes<ExtraAttributes, Profile>;
    this.#transport = transport;
    this.#readContext = readContext;
  }

  with<Attributes extends AttachedAttributes<ExtraAttributes, Profile>>(
    attributes: Exact<Attributes, AttachedAttributes<ExtraAttributes, Profile>>,
  ): Logger<ExtraAttributes, Profile> {
    return new StructuredLogger(
      this.#base,
      { ...this.#attributes, ...attributes } as AttachedAttributes<ExtraAttributes, Profile>,
      this.#transport,
      this.#readContext,
    );
  }

  debug(message: string, attributes?: LogAttributes<ExtraAttributes, Profile>): void {
    this.#write("debug", message, attributes);
  }

  info(message: string, attributes?: LogAttributes<ExtraAttributes, Profile>): void {
    this.#write("info", message, attributes);
  }

  warn(message: string, attributes?: LogAttributes<ExtraAttributes, Profile>): void {
    this.#write("warn", message, attributes);
  }

  error(message: string, attributes?: LogAttributes<ExtraAttributes, Profile>): void {
    this.#write("error", message, attributes);
  }

  #write(
    level: LogLevel,
    message: string,
    attributes: LogAttributes<ExtraAttributes, Profile> | undefined,
  ): void {
    const entry = {
      ...this.#readContext(),
      ...this.#attributes,
      ...attributes,
      ...this.#base,
      message,
    } as LogEntry<ExtraAttributes, Profile>;
    this.#transport(level, entry);
  }
}

export function createLoggerWithContext<
  ExtraAttributes extends object,
  Profile extends AnyLoggerProfile,
>(
  base: LoggerBase<Profile>,
  transport: Transport<LogEntry<ExtraAttributes, Profile>>,
  readContext: ContextReader,
): Logger<ExtraAttributes, Profile> {
  return new StructuredLogger(
    base,
    {} as AttachedAttributes<ExtraAttributes, Profile>,
    transport,
    readContext,
  );
}
