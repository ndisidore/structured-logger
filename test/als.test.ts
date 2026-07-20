import { describe, expect, it } from "vitest";
import { createLogger as createNeutralLogger } from "../src/index.js";
import * as als from "../src/als.js";

type ExtraAttributes = {
  operation: string;
  requestId: string;
};

describe("ALS logger context", () => {
  it("exposes only the factory runtime API", () => {
    expect(Object.keys(als)).toEqual(["createLoggerFactory"]);
  });

  it("inherits nested async context and restores its parent", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      entries.push(entry);
    });
    const logger = logging.createLogger({ component: "api" });

    await logging.withLogContext({ operation: "request" }, async () => {
      await logging.withLogContext({ requestId: "req-1" }, async () => {
        await Promise.resolve();
        logger.info("nested", {});
      });
      logger.info("parent", {});
    });

    expect(entries[0]).toMatchObject({ operation: "request", requestId: "req-1" });
    expect(entries[1]).toMatchObject({ operation: "request" });
    expect(entries[1]).not.toHaveProperty("requestId");
  });

  it("isolates concurrent contexts", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      entries.push(entry);
    });
    const logger = logging.createLogger({ component: "api" });
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
    const first = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      firstEntries.push(entry);
    });
    const second = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      secondEntries.push(entry);
    });

    first.withLogContext({ requestId: "req-1" }, () => {
      first.createLogger({ component: "first" }).info("first", {});
      second.createLogger({ component: "second" }).info("second", {});
    });

    expect(firstEntries[0]).toMatchObject({ requestId: "req-1" });
    expect(secondEntries[0]).not.toHaveProperty("requestId");
  });

  it("applies context, attached attributes, call attributes, and base precedence", () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      entries.push(entry);
    });
    const logger = logging.createLogger({ component: "api" }).with({ operation: "attached" });

    logging.withLogContext({ operation: "ambient" }, () => {
      logger.info("handled", { operation: "call" });
    });

    expect(entries).toEqual([
      {
        component: "api",
        message: "handled",
        operation: "call",
      },
    ]);
  });

  it("does not expose ALS context to the neutral logger", () => {
    const contextualEntries: unknown[] = [];
    const neutralEntries: unknown[] = [];
    const logging = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      contextualEntries.push(entry);
    });
    const neutralLogger = createNeutralLogger<ExtraAttributes>(
      { component: "neutral" },
      (_level, entry) => {
        neutralEntries.push(entry);
      },
    );

    logging.withLogContext({ requestId: "req-1" }, () => {
      logging.createLogger({ component: "api" }).info("contextual", {});
      neutralLogger.info("neutral", {});
    });

    expect(contextualEntries).toEqual([
      {
        component: "api",
        message: "contextual",
        requestId: "req-1",
      },
    ]);
    expect(neutralEntries).toEqual([{ component: "neutral", message: "neutral" }]);
  });
});
