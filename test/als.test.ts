import { describe, expect, it } from "vitest";
import { createLogger as createNeutralLogger } from "../src/index.js";
import * as als from "../src/als.js";

type ExtraAttributes = {
  operation: string;
  requestId: string;
};

describe("ALS logger context", () => {
  it("exposes direct and factory logger creation", () => {
    expect(Object.keys(als)).toEqual(["consoleTransport", "createLogger", "createLoggerFactory"]);
  });

  it("provides context to downstream code through a stable logger reference", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logger = als.createLogger<ExtraAttributes>({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    });
    const handleRequest = async () => {
      await Promise.resolve();
      logger.info("handled");
    };

    await logger.withLogContext({ requestId: "req-1" }, handleRequest);
    logger.info("outside");

    expect(entries).toEqual([
      { component: "api", message: "handled", requestId: "req-1" },
      { component: "api", message: "outside" },
    ]);
  });

  it("merges nested context and restores its parent", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logger = als.createLogger<ExtraAttributes>({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    });

    await logger.withLogContext({ operation: "request" }, async () => {
      await logger.withLogContext({ requestId: "req-1" }, async () => {
        await Promise.resolve();
        logger.info("nested");
      });
      logger.info("parent");
    });

    expect(entries[0]).toMatchObject({ operation: "request", requestId: "req-1" });
    expect(entries[1]).toMatchObject({ operation: "request" });
    expect(entries[1]).not.toHaveProperty("requestId");
  });

  it("shares context across a logger lineage", () => {
    const entries: Array<Record<string, unknown>> = [];
    const logger = als.createLogger<ExtraAttributes>({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    });
    const child = logger.with({ operation: "child" });

    logger.withLogContext({ requestId: "from-root" }, () => child.info("child"));
    child.withLogContext({ requestId: "from-child" }, () => logger.info("root"));

    expect(entries).toEqual([
      {
        component: "api",
        message: "child",
        operation: "child",
        requestId: "from-root",
      },
      { component: "api", message: "root", requestId: "from-child" },
    ]);
  });

  it("isolates roots created by the same factory", () => {
    const entries: Array<Record<string, unknown>> = [];
    const logging = als.createLoggerFactory<ExtraAttributes>((_level, entry) => {
      entries.push(entry);
    });
    const first = logging.createLogger({ component: "first" });
    const second = logging.createLogger({ component: "second" });

    first.withLogContext({ requestId: "req-1" }, () => {
      first.info("first");
      second.info("second");
    });

    expect(entries).toEqual([
      { component: "first", message: "first", requestId: "req-1" },
      { component: "second", message: "second" },
    ]);
  });

  it("isolates concurrent contexts on one logger", async () => {
    const entries: Array<Record<string, unknown>> = [];
    const logger = als.createLogger<ExtraAttributes>({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    });
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });

    const runs = Promise.all([
      logger.withLogContext({ requestId: "req-1" }, async () => {
        await gate;
        logger.info("first", { event: "first" });
      }),
      logger.withLogContext({ requestId: "req-2" }, async () => {
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

  it("does not expose ALS context to a neutral logger", () => {
    const contextualEntries: unknown[] = [];
    const neutralEntries: unknown[] = [];
    const logger = als.createLogger<ExtraAttributes>({ component: "api" }, (_level, entry) => {
      contextualEntries.push(entry);
    });
    const neutralLogger = createNeutralLogger<ExtraAttributes>(
      { component: "neutral" },
      (_level, entry) => {
        neutralEntries.push(entry);
      },
    );

    logger.withLogContext({ requestId: "req-1" }, () => {
      logger.info("contextual");
      neutralLogger.info("neutral");
    });

    expect(contextualEntries).toEqual([
      { component: "api", message: "contextual", requestId: "req-1" },
    ]);
    expect(neutralEntries).toEqual([{ component: "neutral", message: "neutral" }]);
  });
});
