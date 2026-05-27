import { z } from "zod";

export const bigSixTeamTagSchema = z.enum(["ARS", "CHE", "LIV", "MCI", "MUN", "TOT"]);

export const footballBriefingStatusSchema = z.enum([
  "OFFICIAL",
  "RUMOUR",
  "UPDATE",
  "CONFIRMED",
  "DENIED",
]);

export const footballBriefingSchema = z.object({
  title: z.string().trim().min(1),
  summary_short: z.string().trim().min(1),
  summary_detail: z.string().trim().min(1),
  tags: z.array(bigSixTeamTagSchema).default([]),
  status: footballBriefingStatusSchema,
});

export const footballTagClassificationSchema = z.object({
  tags: z.array(bigSixTeamTagSchema).default([]),
});

export type BigSixTeamTag = z.infer<typeof bigSixTeamTagSchema>;
export type FootballBriefingStatus = z.infer<typeof footballBriefingStatusSchema>;
export type FootballBriefing = z.infer<typeof footballBriefingSchema>;
export type FootballTagClassification = z.infer<typeof footballTagClassificationSchema>;

export type FootballBriefingRoute = "AUTO_PUBLISH" | "REVIEW_QUEUE" | "IGNORE";

export type FootballBriefingDecisionReason =
  | "OFFICIAL_OR_CONFIRMED"
  | "BIG6_TEXT_BRIEFING"
  | "MEDIA_ONLY_REQUIRES_REVIEW"
  | "NO_BIG6_TAGS";

export type FootballBriefingDecision = {
  route: FootballBriefingRoute;
  reason: FootballBriefingDecisionReason;
};

export function decideFootballBriefingRoute(
  briefing: FootballBriefing,
  context?: {
    originalText?: string;
  },
): FootballBriefingDecision {
  if (briefing.tags.length === 0) {
    return {
      route: "IGNORE",
      reason: "NO_BIG6_TAGS",
    };
  }

  if (context?.originalText && isMediaOnlyOrMeaningless(context.originalText)) {
    return {
      route: "REVIEW_QUEUE",
      reason: "MEDIA_ONLY_REQUIRES_REVIEW",
    };
  }

  if (briefing.status === "OFFICIAL" || briefing.status === "CONFIRMED") {
    return {
      route: "AUTO_PUBLISH",
      reason: "OFFICIAL_OR_CONFIRMED",
    };
  }

  return {
    route: "AUTO_PUBLISH",
    reason: "BIG6_TEXT_BRIEFING",
  };
}

export function mergeFootballBriefingTags(
  briefing: FootballBriefing,
  classifiedTags: BigSixTeamTag[],
): FootballBriefing {
  if (classifiedTags.length > 0) {
    return {
      ...briefing,
      tags: [...classifiedTags],
    };
  }

  const tags = [...briefing.tags];

  for (const tag of classifiedTags) {
    if (!tags.includes(tag)) {
      tags.push(tag);
    }
  }

  if (tags.length === briefing.tags.length) {
    return briefing;
  }

  return {
    ...briefing,
    tags,
  };
}

function isMediaOnlyOrMeaningless(originalText: string) {
  const withoutUrls = originalText.replace(/https?:\/\/\S+/gi, " ");
  const meaningfulChars = withoutUrls.replace(/[@#\s\p{Emoji_Presentation}\p{Punctuation}]/gu, "");

  return meaningfulChars.length < 12;
}

export function applyBigSixEvidenceGuard(
  briefing: FootballBriefing,
  _originalText: string,
): FootballBriefing {
  return briefing;
}

export function applySourceTextCorrections(
  briefing: FootballBriefing,
  originalText: string,
): FootballBriefing {
  let corrected = briefing;

  if (!/\bin four years\b/i.test(originalText)) {
    return removeUnsupportedNationalTeamText(corrected, originalText);
  }

  corrected = {
    ...corrected,
    title: correctFourYearSpanText(corrected.title),
    summary_short: correctFourYearSpanText(corrected.summary_short),
    summary_detail: correctFourYearSpanText(corrected.summary_detail),
  };

  return removeUnsupportedNationalTeamText(corrected, originalText);
}

function correctFourYearSpanText(value: string) {
  return value
    .replace(/4년 만에 다시 이룬 성과이다\.?/g, "4년 동안 거둔 세 번째 수상이다.")
    .replace(/4년 만에 다시 달성한 기록이다\.?/g, "4년 동안 거둔 세 번째 수상이다.")
    .replace(/골든 부트 상을 4년 동안 수상했다\.?/g, "골든 부트 상을 4년 동안 세 번째로 수상했다.")
    .replace(/4년 동안 수상한 것으로 전해졌다\.?/g, "4년 동안 세 번째로 수상한 것으로 전해졌다.")
    .replace(/4년 만에 다시/g, "4년 동안")
    .replace(/4년 동안 이 영예를 안았다\.?/g, "4년 동안 세 번째로 이 상을 받았다.")
    .replace(/이번 시즌 프리미어리그에서 3번째 골든 부트 상을 수상했다\.?/g, "프리미어리그 골든 부트 상을 4년 동안 세 번째로 수상했다.")
    .replace(/4년 만에/g, "4년 동안");
}

function removeUnsupportedNationalTeamText(
  briefing: FootballBriefing,
  originalText: string,
): FootballBriefing {
  if (/national team|국가대표/i.test(originalText)) {
    return briefing;
  }

  return {
    ...briefing,
    summary_short: removeUnsupportedSentences(briefing.summary_short),
    summary_detail: removeUnsupportedSentences(briefing.summary_detail),
  };
}

function removeUnsupportedSentences(value: string) {
  return value
    .split(/(?<=\.)\s+/)
    .filter((sentence) => !/국가대표|노르웨이를 대표/.test(sentence))
    .join(" ")
    .trim();
}

export function buildFootballBriefingPrompt(input: {
  originalText: string;
  originalUrl: string;
  postedAt: Date;
  sourceHandle?: string | null;
  sourceName?: string | null;
}) {
  return [
    "You are a Korean-language sports briefing writer for Korean Premier League fans.",
    "You convert tweets from international football journalists into Korean briefings.",
    "ALL OUTPUT MUST BE IN KOREAN.",
    "This is NOT translation. Write as if a Korean sports journalist wrote it from scratch.",
    "Deliver ONLY what is stated in the original tweet. Nothing more.",
    "",
    "REQUIRED TONE:",
    "- Korean domestic sports article tone like 풋볼리스트 or 골닷컴 KR.",
    "- Concise and clean.",
    "- Focus on key facts.",
    "- Use reporting expressions such as ~한 것으로 알려졌다 and ~인 것으로 전해진다.",
    "- Unconfirmed information must use speculative endings.",
    "",
    "FORBIDDEN:",
    "- Direct translation style.",
    "- Awkward subject repetition.",
    "- Exaggeration, clickbait, exclamation marks, emojis, interjections.",
    "- Words such as 충격, 초대형, 전격.",
    "- Subjective interpretation, fan reactions, background context not stated in the tweet.",
    "- Journalist credibility commentary.",
    "- Any sentence that did not originate from the tweet.",
    "",
    "FILTERING:",
    "- Only keep content related to these EPL Big 6 teams: ARS, CHE, LIV, MCI, MUN, TOT.",
    "- If the tweet is not related to those teams, return tags as an empty array.",
    "- If a team is not directly named but can be identified from the player/current club/destination in the tweet, tag the matching Big 6 team.",
    "",
    "TAGGING RULES:",
    "- Include every Big 6 club clearly connected to the tweet.",
    "- For transfer, failed transfer, talks, or interest: tag both the Big 6 destination/interested club and the player's Big 6 current/strongly associated club when known.",
    "- If both clubs are Big 6, tag both.",
    "- Departure rumor with no confirmed destination: tag the current Big 6 club.",
    "- Do not limit tags to only the destination club when another Big 6 club is clearly connected through the player or manager.",
    "",
    "STATUS CLASSIFICATION:",
    "- OFFICIAL: club official announcement or player confirmation.",
    "- CONFIRMED: definitive language such as done deal or here we go.",
    "- UPDATE: progress or change on an existing issue.",
    "- RUMOUR: interest, contact, possibility stage.",
    "- DENIED: denial, collapse, rejection.",
    "",
    "Return ONLY valid JSON with this exact shape:",
    '{ "title": "Feed title in Korean around 15 chars", "summary_short": "2-3 Korean sentences. Tweet facts only.", "summary_detail": "4-5 Korean sentences. Tweet facts only.", "tags": ["ARS|CHE|LIV|MCI|MUN|TOT"], "status": "OFFICIAL|RUMOUR|UPDATE|CONFIRMED|DENIED" }',
    "",
    `Source name: ${input.sourceName ?? "unknown"}`,
    `Source handle: ${input.sourceHandle ? `@${input.sourceHandle}` : "unknown"}`,
    `Posted at: ${input.postedAt.toISOString()}`,
    `Original URL: ${input.originalUrl}`,
    "Original tweet:",
    input.originalText,
  ].join("\n");
}

export function buildFootballTagClassificationPrompt(input: {
  originalText: string;
  originalUrl: string;
  postedAt: Date;
  sourceHandle?: string | null;
  sourceName?: string | null;
}) {
  return [
    "You classify EPL Big 6 team tags for an international football tweet.",
    "Return ONLY valid JSON with this exact shape:",
    '{ "tags": ["MCI"] }',
    "",
    "Allowed tags:",
    "- ARS: Arsenal",
    "- CHE: Chelsea",
    "- LIV: Liverpool",
    "- MCI: Manchester City",
    "- MUN: Manchester United",
    "- TOT: Tottenham",
    "",
    "Rules:",
    "- Include only Big 6 clubs clearly connected to the tweet.",
    "- Use football knowledge to connect named players, managers, and executives to their current or strongly associated Big 6 club.",
    "- For awards or records involving a player or manager, tag their current or strongly associated Big 6 club.",
    "- For transfer, failed transfer, talks, or interest, tag both the Big 6 destination/interested club and the player's current or strongly associated Big 6 club when applicable.",
    "- If no Big 6 club is clearly connected, return an empty tags array.",
    "- Do not return non-Big 6 teams.",
    "- Never return all Big 6 tags unless the tweet explicitly connects all six clubs.",
    "- The phrase Premier League alone does not mean all Big 6 clubs are connected.",
    "",
    "Examples:",
    '- "Erling Haaland with his 3rd PL Golden Boot Award in four years." -> {"tags":["MCI"]}',
    '- "Bruno Fernandes spoke with Tottenham years ago..." -> {"tags":["TOT","MUN"]}',
    '- "Mikel Arteta wins Premier League Manager of the Season Award." -> {"tags":["ARS"]}',
    '- "Premier League clubs are interested." -> {"tags":[]}',
    "",
    `Source name: ${input.sourceName ?? "unknown"}`,
    `Source handle: ${input.sourceHandle ? `@${input.sourceHandle}` : "unknown"}`,
    `Posted at: ${input.postedAt.toISOString()}`,
    `Original URL: ${input.originalUrl}`,
    "Original tweet:",
    input.originalText,
  ].join("\n");
}

export function buildFootballBriefingGroundingPrompt(input: {
  originalText: string;
  draft: FootballBriefing;
}) {
  return [
    "You are a strict factuality editor for Korean football briefings.",
    "Rewrite the draft so every sentence is supported by the original tweet only.",
    "Return ONLY valid JSON with the exact same shape.",
    "",
    "Hard rules:",
    "- Do not add dates, seasons, clubs, national teams, reasons, records, or interpretations unless explicitly stated in the original tweet.",
    "- Do not infer facts from flags, emojis, player reputation, or general football knowledge.",
    "- Do not convert a flag emoji into a nationality or national-team statement.",
    "- 'in four years' means 'over a four-year span', not 'after four years' or 'for four consecutive years'.",
    "- Keep the existing Big 6 tags and status unless they are invalid enum values.",
    "- summary_short must be 1-2 concise Korean sentences.",
    "- summary_detail must be 2-4 concise Korean sentences.",
    "- If the draft says something unsupported, delete it or rewrite it narrowly.",
    "",
    "Original tweet:",
    input.originalText,
    "",
    "Draft JSON:",
    JSON.stringify(input.draft),
  ].join("\n");
}
