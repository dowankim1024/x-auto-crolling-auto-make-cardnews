import assert from "node:assert/strict";
import { describe, it } from "node:test";

import {
  applyBigSixEvidenceGuard,
  applySourceTextCorrections,
  decideFootballBriefingRoute,
  footballBriefingSchema,
  mergeFootballBriefingTags,
} from "../lib/football-briefing";
import {
  parseFootballBriefingContent,
  parseFootballTagClassificationContent,
} from "../lib/upstage-content";

describe("footballBriefingSchema", () => {
  it("accepts the Korean briefing JSON shape from content.md", () => {
    const result = footballBriefingSchema.parse({
      title: "첼시, 윌디즈 영입 추진",
      summary_short:
        "첼시가 윌디즈 영입을 추진 중인 것으로 알려졌다. 협상은 진행 단계인 것으로 전해진다.",
      summary_detail:
        "첼시가 윌디즈 영입을 추진 중인 것으로 알려졌다. 현지 보도에 따르면 양측 접촉이 이어지고 있다. 아직 공식 발표는 나오지 않았다. 선수 측과 구단 간 논의가 진행 중인 것으로 전해진다.",
      tags: ["CHE"],
      status: "RUMOUR",
    });

    assert.equal(result.title, "첼시, 윌디즈 영입 추진");
    assert.deepEqual(result.tags, ["CHE"]);
    assert.equal(result.status, "RUMOUR");
  });

  it("rejects non-Big 6 team tags", () => {
    assert.throws(
      () =>
        footballBriefingSchema.parse({
          title: "레알, 영입 추진",
          summary_short: "레알 마드리드가 영입을 추진 중인 것으로 알려졌다.",
          summary_detail:
            "레알 마드리드가 영입을 추진 중인 것으로 알려졌다. 아직 공식 발표는 나오지 않았다. 현지 보도에 따르면 논의가 이어지고 있다. 세부 조건은 공개되지 않았다.",
          tags: ["RMA"],
          status: "RUMOUR",
        }),
      /Invalid option/,
    );
  });
});

describe("decideFootballBriefingRoute", () => {
  it("routes official Big 6 content to auto publish", () => {
    const decision = decideFootballBriefingRoute({
      title: "맨유, 영입 공식 발표",
      summary_short: "맨유가 영입을 공식 발표했다.",
      summary_detail:
        "맨유가 영입을 공식 발표했다. 구단 발표에 따르면 계약이 완료됐다. 선수의 합류도 확인됐다. 세부 조건은 발표 내용에 포함됐다.",
      tags: ["MUN"],
      status: "OFFICIAL",
    });

    assert.equal(decision.route, "AUTO_PUBLISH");
    assert.equal(decision.reason, "OFFICIAL_OR_CONFIRMED");
  });

  it("routes meaningful rumours to auto publish when Big 6 tags exist", () => {
    const decision = decideFootballBriefingRoute({
      title: "아스널, 공격수 관심",
      summary_short: "아스널이 공격수 영입에 관심을 보이고 있다는 현지 보도.",
      summary_detail:
        "아스널이 공격수 영입에 관심을 보이고 있다는 현지 보도다. 아직 공식 제안 여부는 확인되지 않았다. 선수 측과 접촉 가능성이 거론됐다. 구단 발표는 나오지 않았다.",
      tags: ["ARS"],
      status: "RUMOUR",
    });

    assert.equal(decision.route, "AUTO_PUBLISH");
    assert.equal(decision.reason, "BIG6_TEXT_BRIEFING");
  });

  it("routes media-only posts to review even when AI produced a Big 6 tag", () => {
    const decision = decideFootballBriefingRoute(
      {
        title: "토트넘 영상 업데이트",
        summary_short: "토트넘 관련 영상 게시물이다.",
        summary_detail: "토트넘 관련 영상 게시물이다.",
        tags: ["TOT"],
        status: "UPDATE",
      },
      {
        originalText: "🎥 https://t.co/example",
      },
    );

    assert.equal(decision.route, "REVIEW_QUEUE");
    assert.equal(decision.reason, "MEDIA_ONLY_REQUIRES_REVIEW");
  });

  it("ignores output without Big 6 tags", () => {
    const decision = decideFootballBriefingRoute({
      title: "분데스리가 이적 소식",
      summary_short: "독일 구단 간 이적 논의가 진행 중인 것으로 알려졌다.",
      summary_detail:
        "독일 구단 간 이적 논의가 진행 중인 것으로 알려졌다. 아직 공식 발표는 없다. 세부 조건은 공개되지 않았다. EPL 빅6 관련 내용은 언급되지 않았다.",
      tags: [],
      status: "UPDATE",
    });

    assert.equal(decision.route, "IGNORE");
    assert.equal(decision.reason, "NO_BIG6_TAGS");
  });
});

describe("mergeFootballBriefingTags", () => {
  it("adds Big 6 tags from a dedicated tag classifier without dropping generated tags", () => {
    const briefing = mergeFootballBriefingTags(
      {
        title: "하란드, 골든 부트 수상",
        summary_short: "엘링 홀란이 골든 부트를 수상했다.",
        summary_detail:
          "엘링 홀란이 프리미어리그 골든 부트를 수상했다. 4년 동안 세 번째 수상으로 전해진다.",
        tags: [],
        status: "OFFICIAL",
      },
      ["MCI"],
    );

    assert.deepEqual(briefing.tags, ["MCI"]);
  });

  it("keeps both transfer-linked clubs when the classifier returns both", () => {
    const briefing = mergeFootballBriefingTags(
      {
        title: "브루노, 토트넘 이적 무산",
        summary_short: "브루노 페르난데스가 토트넘과 과거 협상했다고 밝혔다.",
        summary_detail:
          "브루노 페르난데스가 토트넘과 과거 협상했다고 밝혔다. 협상은 막판에 무산됐다고 전했다.",
        tags: ["TOT"],
        status: "RUMOUR",
      },
      ["MUN", "TOT"],
    );

    assert.deepEqual(briefing.tags, ["MUN", "TOT"]);
  });

  it("uses classifier tags as authoritative when generated tags over-broaden to all Big 6 teams", () => {
    const briefing = mergeFootballBriefingTags(
      {
        title: "하란드, 골든 부트 수상",
        summary_short: "하란드가 골든 부트를 수상했다.",
        summary_detail: "하란드가 골든 부트를 수상했다.",
        tags: ["ARS", "CHE", "LIV", "MCI", "MUN", "TOT"],
        status: "OFFICIAL",
      },
      ["MCI"],
    );

    assert.deepEqual(briefing.tags, ["MCI"]);
  });
});

describe("applySourceTextCorrections", () => {
  it("corrects 'in four years' mistranslation from '4년 만에' to a four-year span", () => {
    const corrected = applySourceTextCorrections(
      {
        title: "하란드, 4년 만에 PL 골든 부트 3회 수상",
        summary_short:
          "에를링 하란드가 프리미어리그 골든 부트 상을 3번째로 수상했다. 이는 4년 만에 다시 이룬 성과이다.",
        summary_detail:
          "에를링 하란드가 프리미어리그 골든 부트 상을 3번째로 수상했다. 이는 4년 만에 다시 이룬 성과이다.",
        tags: ["MCI"],
        status: "OFFICIAL",
      },
      "Erling Haaland with his 3rd PL Golden Boot Award in four years.",
    );

    assert.equal(corrected.title, "하란드, 4년 동안 PL 골든 부트 3회 수상");
    assert.match(corrected.summary_short, /4년 동안 거둔 세 번째 수상/);
    assert.doesNotMatch(corrected.summary_detail, /4년 만에/);
  });
});

describe("applyBigSixEvidenceGuard", () => {
  it("keeps AI Big 6 tags even when the original tweet uses player-only context", () => {
    const guarded = applyBigSixEvidenceGuard(
      {
        title: "비니시우스, 재계약 서두르지 않는다",
        summary_short: "비니시우스 주니어가 재계약을 서두르지 않겠다고 밝혔다.",
        summary_detail:
          "비니시우스 주니어가 재계약을 서두르지 않겠다고 밝혔다. 그는 2027년까지 계약이 남아 있다고 말했다. 마드리드와 논의할 시간이 있다고 언급했다. 회장과의 신뢰도 언급했다.",
        tags: ["MCI"],
        status: "RUMOUR",
      },
      "Vinicius Jr: I’m in no rush to renew my contract. I have a contract until 2027. Madrid is calm.",
    );

    assert.deepEqual(guarded.tags, ["MCI"]);
  });

  it("keeps AI tags when the original tweet explicitly names a Big 6 team", () => {
    const guarded = applyBigSixEvidenceGuard(
      {
        title: "맨유, 영입 공식 발표",
        summary_short: "맨유가 영입을 공식 발표했다.",
        summary_detail:
          "맨유가 영입을 공식 발표했다. 구단 발표에 따르면 계약이 완료됐다. 선수의 합류도 확인됐다. 세부 조건은 발표 내용에 포함됐다.",
        tags: ["MUN"],
        status: "OFFICIAL",
      },
      "Manchester United have officially announced the signing.",
    );

    assert.deepEqual(guarded.tags, ["MUN"]);
  });
});

describe("parseFootballBriefingContent", () => {
  it("parses fenced JSON returned by a chat model", () => {
    const briefing = parseFootballBriefingContent(`\`\`\`json
{
  "title": "리버풀, 계약 발표",
  "summary_short": "리버풀이 계약을 공식 발표했다. 구단 발표를 통해 합류가 확인됐다.",
  "summary_detail": "리버풀이 계약을 공식 발표했다. 구단 발표를 통해 선수 합류가 확인됐다. 발표문에는 계약 완료 사실이 담겼다. 추가 조건은 공개된 내용에 한정된다.",
  "tags": ["LIV"],
  "status": "OFFICIAL"
}
\`\`\``);

    assert.equal(briefing.title, "리버풀, 계약 발표");
    assert.deepEqual(briefing.tags, ["LIV"]);
    assert.equal(briefing.status, "OFFICIAL");
  });
});

describe("parseFootballTagClassificationContent", () => {
  it("normalizes common team names returned by the classifier into Big 6 tags", () => {
    const result = parseFootballTagClassificationContent(
      JSON.stringify({ tags: ["Manchester City", "Man United", "Spurs"] }),
    );

    assert.deepEqual(result.tags, ["MCI", "MUN", "TOT"]);
  });
});
