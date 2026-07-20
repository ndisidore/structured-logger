import { describe, expect, it, vi } from "vitest";
import { createLogger, createLoggerFactory, type LoggerProfile } from "../src/index.js";

type ExtraAttributes = {
  durationMs: number;
  operation: string;
  requestId: string;
};

describe("structured logger", () => {
  it("writes a structured entry to the matching console method by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createLogger<ExtraAttributes>({ component: "api" });

    logger.info("request handled", { durationMs: 12 });

    expect(info).toHaveBeenCalledWith({
      component: "api",
      durationMs: 12,
      message: "request handled",
    });
    info.mockRestore();
  });

  it("allows entries without call attributes", () => {
    const entries: unknown[] = [];
    const logger = createLogger({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    });

    logger.info("started");

    expect(entries).toEqual([{ component: "api", message: "started" }]);
  });

  it("passes the level and complete entry to a custom transport", () => {
    const writes: unknown[] = [];
    const logger = createLogger<ExtraAttributes>({ component: "api" }, (level, entry) => {
      writes.push([level, entry]);
    }).with({ operation: "request" });

    logger.warn("request slowed", {
      event: "request.slowed",
      durationMs: 500,
    });

    expect(writes).toEqual([
      [
        "warn",
        {
          component: "api",
          durationMs: 500,
          event: "request.slowed",
          message: "request slowed",
          operation: "request",
        },
      ],
    ]);
  });

  it("derives immutable loggers with call attributes taking precedence", () => {
    const entries: unknown[] = [];
    const logger = createLogger<ExtraAttributes>({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    }).with({ operation: "parent" });
    const child = logger.with({ operation: "child", requestId: "req-1" });

    child.debug("child", { event: "child", operation: "call" });
    logger.debug("parent", { event: "parent" });

    expect(entries).toEqual([
      {
        component: "api",
        event: "child",
        message: "child",
        operation: "call",
        requestId: "req-1",
      },
      {
        component: "api",
        event: "parent",
        message: "parent",
        operation: "parent",
      },
    ]);
  });

  it("passes error values through unchanged", () => {
    const entries: Array<{ error?: unknown }> = [];
    const logger = createLogger({ component: "api" }, (_level, entry) => {
      entries.push(entry);
    });
    const error = new Error("boom");

    logger.error("failed", { error });

    expect(entries[0]?.error).toBe(error);
  });

  it("propagates transport failures", () => {
    const logger = createLogger({ component: "api" }, () => {
      throw new Error("transport failed");
    });

    expect(() => logger.error("failed", {})).toThrow("transport failed");
  });

  it("shares a transport through a factory", () => {
    const entries: unknown[] = [];
    const logging = createLoggerFactory<ExtraAttributes>((_level, entry) => {
      entries.push(entry);
    });

    logging.createLogger({ component: "worker" }).info("started", {
      event: "worker.started",
    });

    expect(entries).toEqual([{ component: "worker", event: "worker.started", message: "started" }]);
  });

  it("supports custom profiles without changing values", () => {
    type AuditProfile = LoggerProfile<{ service: string }, { action: string; failure?: unknown }>;
    const writes: unknown[] = [];
    const logger = createLogger<{ actor: string }, AuditProfile>(
      { service: "billing" },
      (level, entry) => {
        writes.push([level, entry]);
      },
    );
    const failure = { reason: "declined" };

    logger.error("charge rejected", {
      action: "charge.reject",
      actor: "customer-1",
      failure,
    });

    expect(writes).toEqual([
      [
        "error",
        {
          action: "charge.reject",
          actor: "customer-1",
          failure,
          message: "charge rejected",
          service: "billing",
        },
      ],
    ]);
  });
});
