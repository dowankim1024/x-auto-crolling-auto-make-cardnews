import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  classifyCommonsLicense,
  normalizeCommonsImageCandidate,
} from "../lib/wikimedia-commons";

describe("classifyCommonsLicense", () => {
  it("allows CC0 and public domain as no-restriction images", () => {
    assert.equal(classifyCommonsLicense("CC0 1.0")?.licenseSafety, "SAFE_NO_RESTRICTIONS");
    assert.equal(
      classifyCommonsLicense("Public domain")?.requiresAttribution,
      false,
    );
  });

  it("allows CC BY with attribution", () => {
    const license = classifyCommonsLicense("CC BY 4.0");

    assert.equal(license?.licenseSafety, "SAFE_WITH_ATTRIBUTION");
    assert.equal(license?.requiresAttribution, true);
    assert.equal(license?.requiresShareAlike, false);
  });

  it("allows CC BY-SA but marks share-alike review", () => {
    const license = classifyCommonsLicense("CC BY-SA 4.0");

    assert.equal(license?.licenseSafety, "REVIEW_SAME_LICENSE");
    assert.equal(license?.requiresShareAlike, true);
  });

  it("blocks unsupported licenses", () => {
    assert.equal(classifyCommonsLicense("CC BY-NC 4.0"), null);
    assert.equal(classifyCommonsLicense("All rights reserved"), null);
  });
});

describe("normalizeCommonsImageCandidate", () => {
  it("maps Wikimedia imageinfo metadata into an ImageAsset candidate", () => {
    const candidate = normalizeCommonsImageCandidate({
      pageid: 123,
      title: "File:Example.jpg",
      imageinfo: [
        {
          url: "https://upload.wikimedia.org/example.jpg",
          thumburl: "https://upload.wikimedia.org/thumb.jpg",
          descriptionshorturl: "https://commons.wikimedia.org/wiki/File:Example.jpg",
          extmetadata: {
            LicenseShortName: { value: "CC BY-SA 4.0" },
            LicenseUrl: { value: "https://creativecommons.org/licenses/by-sa/4.0/" },
            Artist: { value: "Example Photographer" },
            ObjectName: { value: "Example image" },
          },
        },
      ],
    });

    assert.ok(candidate);
    assert.equal(candidate.providerAssetId, "123");
    assert.equal(candidate.licenseSafety, "REVIEW_SAME_LICENSE");
    assert.equal(candidate.requiresShareAlike, true);
    assert.match(candidate.creditText, /Wikimedia Commons/);
    assert.match(candidate.creditText, /Example Photographer/);
  });
});
