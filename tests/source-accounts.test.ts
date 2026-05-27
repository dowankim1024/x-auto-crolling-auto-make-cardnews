import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  parseSourceAccountInput,
  SourceAccountInputError,
} from "../lib/source-accounts";

describe("parseSourceAccountInput", () => {
  it("normalizes account fields", () => {
    const input = parseSourceAccountInput({
      platform: " x ",
      handle: " @FabrizioRomano ",
      displayName: " Fabrizio Romano ",
      sportType: " pl ",
      sourceTier: "1",
      isActive: "true",
    });

    assert.equal(input.platform, "X");
    assert.equal(input.handle, "FabrizioRomano");
    assert.equal(input.displayName, "Fabrizio Romano");
    assert.equal(input.sportType, "PL");
    assert.equal(input.sourceTier, 1);
    assert.equal(input.isActive, true);
  });

  it("defaults isActive to true", () => {
    const input = parseSourceAccountInput({
      platform: "x",
      handle: "@example",
      sportType: "nba",
      sourceTier: "3",
    });

    assert.equal(input.isActive, true);
  });

  it("throws field errors for invalid values", () => {
    assert.throws(
      () =>
        parseSourceAccountInput({
          platform: "",
          handle: "",
          sportType: "",
          sourceTier: "0",
        }),
      (error) => {
        assert.ok(error instanceof SourceAccountInputError);
        assert.ok(error.fieldErrors.platform);
        assert.ok(error.fieldErrors.handle);
        assert.ok(error.fieldErrors.sportType);
        assert.ok(error.fieldErrors.sourceTier);
        return true;
      },
    );
  });
});
