import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseCreateRawPostInput,
  RawPostInputError,
} from "../lib/raw-posts";

describe("parseCreateRawPostInput", () => {
  it("normalizes a manual X post input", () => {
    const input = parseCreateRawPostInput({
      sourceHandle: " @FabrizioRomano ",
      originalText: " Manchester United are monitoring a midfielder. ",
      originalUrl: "https://x.com/FabrizioRomano/status/123",
      postedAt: "2026-05-17T10:30:00.000Z",
      language: " en ",
    });

    assert.equal(input.sourceHandle, "FabrizioRomano");
    assert.equal(input.externalPostId, "x-manual-123");
    assert.equal(input.originalText, "Manchester United are monitoring a midfielder.");
    assert.equal(input.language, "en");
    assert.equal(input.postedAt.toISOString(), "2026-05-17T10:30:00.000Z");
  });

  it("uses a deterministic manual id when no X status id exists", () => {
    const input = parseCreateRawPostInput({
      originalText: "A manually pasted report",
      originalUrl: "https://example.com/report",
    });

    assert.equal(input.externalPostId, "manual-https-example-com-report");
  });

  it("throws a field error for invalid input", () => {
    assert.throws(
      () =>
        parseCreateRawPostInput({
          originalText: "",
          originalUrl: "not-a-url",
        }),
      (error) => {
        assert.ok(error instanceof RawPostInputError);
        assert.ok(error.fieldErrors.originalText);
        assert.ok(error.fieldErrors.originalUrl);
        return true;
      },
    );
  });
});
