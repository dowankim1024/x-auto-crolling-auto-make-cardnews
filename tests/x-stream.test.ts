import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildFilteredStreamRuleValue,
  buildTweetUrl,
  parseStreamTweetPayload,
} from "../lib/x-stream";

describe("buildFilteredStreamRuleValue", () => {
  it("builds a focused rule for watched accounts", () => {
    const rule = buildFilteredStreamRuleValue([
      { handle: "@FabrizioRomano" },
      { handle: "David_Ornstein" },
    ]);

    assert.equal(
      rule,
      "(from:FabrizioRomano OR from:David_Ornstein) -is:retweet -is:reply",
    );
  });
});

describe("parseStreamTweetPayload", () => {
  it("maps a streamed tweet into a RawPost shape", () => {
    const result = parseStreamTweetPayload({
      data: {
        id: "1234567890",
        text: "Manchester United are monitoring a midfielder.",
        created_at: "2026-05-18T00:00:00.000Z",
        lang: "en",
        author_id: "999",
      },
      includes: {
        users: [
          {
            id: "999",
            username: "FabrizioRomano",
            name: "Fabrizio Romano",
          },
        ],
      },
      matching_rules: [
        {
          id: "1",
          tag: "x-cardnews-admin:watched-accounts",
        },
      ],
    });

    assert.equal(result.externalPostId, "1234567890");
    assert.equal(result.originalText, "Manchester United are monitoring a midfielder.");
    assert.equal(result.originalUrl, "https://x.com/FabrizioRomano/status/1234567890");
    assert.equal(result.language, "en");
    assert.equal(result.sourceHandle, "FabrizioRomano");
    assert.equal(result.postedAt.toISOString(), "2026-05-18T00:00:00.000Z");
  });
});

describe("buildTweetUrl", () => {
  it("builds an X status URL", () => {
    assert.equal(
      buildTweetUrl("FabrizioRomano", "1234567890"),
      "https://x.com/FabrizioRomano/status/1234567890",
    );
  });
});
