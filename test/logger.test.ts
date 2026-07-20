import { describe, expect, it, vi } from "vitest";
import { createLogger, createLoggerFactory, type LoggerTypes } from "../src/index.js";

type Fields = {
  durationMs: number;
  operation: string;
  requestId: string;
};

describe("structured logger", () => {
  it("writes a structured entry to the matching console method by default", () => {
    const info = vi.spyOn(console, "info").mockImplementation(() => undefined);
    const logger = createLogger<Fields>({ base: { component: "api" } });

    logger.info("request handled", {
      event: "request.handled",
      durationMs: 12,
    });

    expect(info).toHaveBeenCalledWith({
      component: "api",
      durationMs: 12,
      event: "request.handled",
      message: "request handled",
    });
    info.mockRestore();
  });

  it("passes the level and complete entry to a custom transport", () => {
    const writes: unknown[] = [];
    const logger = createLogger<Fields>({
      base: { component: "api" },
      fields: { operation: "request" },
      transport: (level, entry) => writes.push([level, entry]),
    });

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

  it("derives immutable children and applies deterministic field precedence", () => {
    const entries: unknown[] = [];
    const logger = createLogger<Fields>({
      base: { component: "api" },
      fields: { operation: "parent" },
      transport: (_level, entry) => entries.push(entry),
    });
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
    const logger = createLogger({
      base: { component: "api" },
      transport: (_level, entry) => entries.push(entry),
    });
    const error = new Error("boom");

    logger.error("failed", { event: "request.failed", error });

    expect(entries[0]?.error).toBe(error);
  });

  it("propagates transport failures", () => {
    const logger = createLogger({
      base: { component: "api" },
      transport: () => {
        throw new Error("transport failed");
      },
    });

    expect(() => logger.error("failed", { event: "request.failed" })).toThrow("transport failed");
  });

  it("supports reusable transports through a factory", () => {
    const entries: unknown[] = [];
    const logging = createLoggerFactory<Fields>({
      transport: (_level, entry) => entries.push(entry),
    });

    logging
      .createLogger({ base: { component: "worker" } })
      .info("started", { event: "worker.started" });

    expect(entries).toEqual([{ component: "worker", event: "worker.started", message: "started" }]);
  });

  it("supports custom type profiles without changing values", () => {
    type AuditTypes = LoggerTypes<
      { service: string },
      { action: string; failure?: unknown },
      "password" | "token"
    >;
    const writes: unknown[] = [];
    const logger = createLogger<{ actor: string }, AuditTypes>({
      base: { service: "billing" },
      transport: (level, entry) => writes.push([level, entry]),
    });
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
