import { readFile } from "node:fs/promises";
import { describe, expect, it } from "vitest";

describe("browser entry point", () => {
  it("does not import Node builtins", async () => {
    const root = await readFile(new URL("../src/index.ts", import.meta.url), "utf8");
    const core = await readFile(new URL("../src/core.ts", import.meta.url), "utf8");

    expect(root).not.toContain('from "node:');
    expect(core).not.toContain('from "node:');
  });
});
