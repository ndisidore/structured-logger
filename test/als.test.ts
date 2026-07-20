import { describe, expect, it } from "vitest";
import { createLogger as createNeutralLogger } from "../src/index.js";
import { createLogger, createLoggerFactory, withLogContext } from "../src/als.js";

type Fields = {
  operation: string;
  requestId: string;
};

describe("ALS logger context", () => {
  it("inherits nested async context and restores its parent", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = createLoggerFactory<Fields>({
      transport: (_level, entry) => entries.push(entry),
    });
    const logger = logging.createLogger({ base: { component: "api" } });

    await logging.withLogContext({ operation: "request" }, async () => {
      await logging.withLogContext({ requestId: "req-1" }, async () => {
        await Promise.resolve();
        logger.info("nested", { event: "nested" });
      });
      logger.info("parent", { event: "parent" });
    });

    expect(entries[0]).toMatchObject({ operation: "request", requestId: "req-1" });
    expect(entries[1]).toMatchObject({ operation: "request" });
    expect(entries[1]).not.toHaveProperty("requestId");
  });

  it("isolates concurrent contexts", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = createLoggerFactory<Fields>({
      transport: (_level, entry) => entries.push(entry),
    });
    const logger = logging.createLogger({ base: { component: "api" } });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const runs = Promise.all([
      logging.withLogContext({ requestId: "req-1" }, async () => {
        await gate;
        logger.info("first", { event: "first" });
      }),
      logging.withLogContext({ requestId: "req-2" }, async () => {
        await gate;
        logger.info("second", { event: "second" });
      }),
    ]);
    release();
    await runs;

    expect(entries).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ event: "first", requestId: "req-1" }),
        expect.objectContaining({ event: "second", requestId: "req-2" }),
      ]),
    );
  });

  it("isolates context between factories", () => {
    const firstEntries: Array<Record<string, unknown>> = [];
    const secondEntries: Array<Record<string, unknown>> = [];
    const first = createLoggerFactory<Fields>({
      transport: (_level, entry) => firstEntries.push(entry),
    });
    const second = createLoggerFactory<Fields>({
      transport: (_level, entry) => secondEntries.push(entry),
    });

    first.withLogContext({ requestId: "req-1" }, () => {
      first.createLogger({ base: { component: "first" } }).info("first", { event: "first" });
      second.createLogger({ base: { component: "second" } }).info("second", { event: "second" });
    });

    expect(firstEntries[0]).toMatchObject({ requestId: "req-1" });
    expect(secondEntries[0]).not.toHaveProperty("requestId");
  });

  it("applies context, bound fields, details, and base precedence", () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = createLoggerFactory<Fields>({
      transport: (_level, entry) => entries.push(entry),
    });
    const logger = logging.createLogger({
      base: { component: "api" },
      fields: { operation: "bound" },
    });

    logging.withLogContext({ operation: "ambient" }, () => {
      logger.info("handled", { event: "handled", operation: "details" });
    });

    expect(entries).toEqual([
      {
        component: "api",
        event: "handled",
        message: "handled",
        operation: "details",
      },
    ]);
  });

  it("shares module context across direct loggers", () => {
    const entries: Array<Record<string, unknown>> = [];
    const first = createLogger<Fields>({
      base: { component: "first" },
      transport: (_level, entry) => entries.push(entry),
    });
    const second = createLogger<Fields>({
      base: { component: "second" },
      transport: (_level, entry) => entries.push(entry),
    });

    withLogContext<Pick<Fields, "requestId">, void>({ requestId: "req-1" }, () => {
      first.info("first", { event: "first" });
      second.info("second", { event: "second" });
    });

    expect(entries).toEqual([
      { component: "first", event: "first", message: "first", requestId: "req-1" },
      { component: "second", event: "second", message: "second", requestId: "req-1" },
    ]);
  });

  it("does not expose context to the neutral logger", () => {
    const contextualEntries: unknown[] = [];
    const neutralEntries: unknown[] = [];
    const logging = createLoggerFactory<Fields>({
      transport: (_level, entry) => contextualEntries.push(entry),
    });
    const neutralLogger = createNeutralLogger<Fields>({
      base: { component: "neutral" },
      transport: (_level, entry) => neutralEntries.push(entry),
    });

    logging.withLogContext({ requestId: "req-1" }, () => {
      logging
        .createLogger({ base: { component: "api" } })
        .info("contextual", { event: "contextual" });
      neutralLogger.info("neutral", { event: "neutral" });
    });

    expect(contextualEntries).toEqual([
      {
        component: "api",
        event: "contextual",
        message: "contextual",
        requestId: "req-1",
      },
    ]);
    expect(neutralEntries).toEqual([
      { component: "neutral", event: "neutral", message: "neutral" },
    ]);
  });
});
