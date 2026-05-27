import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  buildImageSearchQueries,
  buildInstagramCaption,
  buildTwoSlideCardNews,
  type AcceptedRawPostDraft,
} from "../lib/cardnews-pipeline";

const draft: AcceptedRawPostDraft = {
  translatedText: "맨체스터 유나이티드가 미드필더를 주시 중이다.",
  oneLineSummary: "맨유가 미드필더 영입 후보를 모니터링 중이다.",
  shortSummary: "맨유의 중원 보강 움직임.",
  detectedTeams: ["Manchester United"],
  detectedPlayers: ["Player A"],
  detectedKeywords: ["transfer"],
  postType: "GENERAL",
  suggestedRumorStatus: "monitoring",
  riskFlags: [],
  title: "맨유, 중원 보강 후보 주시",
  subtitle: "이적시장 모니터링 단계",
  summary: "맨유가 미드필더 후보를 살피고 있다는 보도다.",
  body: "Fabrizio Romano X 원문에 따르면 맨유가 후보를 주시 중이다. 사진 출처: Wikimedia Commons.",
  teamTags: ["Manchester United"],
  playerTags: ["Player A"],
  hashtags: ["맨유", "이적시장"],
  instagramCaption: "맨유가 중원 보강 후보를 주시 중입니다.",
  instagramHashtags: ["맨유", "#이적시장"],
  cardTitle: "맨유, 미드필더 주시",
  cardSummary: "아직 협상 단계는 아니며 후보군 모니터링으로 전해졌다.",
  imageQueries: ["Manchester United midfielder", "Player A"],
};

describe("buildImageSearchQueries", () => {
  it("deduplicates and limits image queries", () => {
    assert.deepEqual(buildImageSearchQueries(draft), [
      "Manchester United midfielder",
      "Player A",
      "Manchester United",
    ]);
  });
});

describe("buildInstagramCaption", () => {
  it("adds X and Wikimedia attribution for Instagram", () => {
    const caption = buildInstagramCaption({
      draft,
      sourceName: "Fabrizio Romano",
      sourceHandle: "FabrizioRomano",
      originalUrl: "https://x.com/FabrizioRomano/status/1",
    });

    assert.match(caption, /출처: Fabrizio Romano \(@FabrizioRomano\)/);
    assert.match(caption, /사진 출처: Wikimedia Commons/);
    assert.match(caption, /#맨유 #이적시장/);
  });
});

describe("buildTwoSlideCardNews", () => {
  it("creates the requested main and source slides", () => {
    const slides = buildTwoSlideCardNews({
      draft,
      sourceName: "Fabrizio Romano",
      sourceHandle: "FabrizioRomano",
      originalText: "Manchester United are monitoring a midfielder.",
      originalUrl: "https://x.com/FabrizioRomano/status/1",
      imageAssetId: "image_1",
    });

    assert.equal(slides.length, 2);
    assert.equal(slides[0].templateType, "MAIN_IMAGE_TITLE_SUMMARY");
    assert.equal(slides[0].imageAssetId, "image_1");
    assert.equal(slides[1].templateType, "SOURCE_TWEET_CONTEXT");
    assert.match(slides[1].footnote ?? "", /Fabrizio Romano/);
  });
});
