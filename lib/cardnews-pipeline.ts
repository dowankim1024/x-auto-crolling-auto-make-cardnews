import { z } from "zod";

export const acceptedRawPostDraftSchema = z.object({
  translatedText: z.string().min(1),
  oneLineSummary: z.string().min(1),
  shortSummary: z.string().optional(),
  detectedTeams: z.array(z.string()).default([]),
  detectedPlayers: z.array(z.string()).default([]),
  detectedKeywords: z.array(z.string()).default([]),
  postType: z.enum(["GENERAL", "POLL", "TODAY_DEBATE"]).default("GENERAL"),
  suggestedRumorStatus: z.string().optional(),
  riskFlags: z.array(z.string()).default([]),
  title: z.string().min(1),
  subtitle: z.string().optional(),
  summary: z.string().min(1),
  body: z.string().min(1),
  teamTags: z.array(z.string()).default([]),
  playerTags: z.array(z.string()).default([]),
  hashtags: z.array(z.string()).default([]),
  instagramCaption: z.string().min(1),
  instagramHashtags: z.array(z.string()).default([]),
  cardTitle: z.string().min(1),
  cardSummary: z.string().min(1),
  imageQueries: z.array(z.string()).min(1).max(5),
});

export type AcceptedRawPostDraft = z.infer<typeof acceptedRawPostDraftSchema>;

export type SourceForDraft = {
  handle?: string | null;
  displayName?: string | null;
};

export type RawPostForDraft = {
  originalText: string;
  originalUrl: string;
  postedAt: Date;
  language?: string | null;
  sourceAccount?: SourceForDraft | null;
};

export function buildAcceptedRawPostPrompt(rawPost: RawPostForDraft) {
  const sourceName =
    rawPost.sourceAccount?.displayName ??
    rawPost.sourceAccount?.handle ??
    "unknown X source";
  const sourceHandle = rawPost.sourceAccount?.handle
    ? `@${rawPost.sourceAccount.handle}`
    : "unknown";

  return [
    "You create Korean Instagram-ready football/sports card news drafts from accepted X posts.",
    "The admin has already accepted this raw post, so LLM processing is allowed.",
    "Return only JSON matching the schema.",
    "Do not invent facts beyond the original post. Keep uncertainty and rumor wording clear.",
    "The article body must include: the X source/journalist account, the original X URL, and an image credit sentence that says the selected images are from Wikimedia Commons.",
    "Write for Instagram: compact paragraphs, useful tags, and no markdown.",
    "",
    `Source name: ${sourceName}`,
    `Source handle: ${sourceHandle}`,
    `Posted at: ${rawPost.postedAt.toISOString()}`,
    `Language: ${rawPost.language ?? "unknown"}`,
    `Original URL: ${rawPost.originalUrl}`,
    "Original text:",
    rawPost.originalText,
  ].join("\n");
}

export function uniqueCleanStrings(values: string[], limit: number) {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const clean = value.trim().replace(/\s+/g, " ");
    const key = clean.toLowerCase();

    if (!clean || seen.has(key)) {
      continue;
    }

    seen.add(key);
    result.push(clean);

    if (result.length >= limit) {
      break;
    }
  }

  return result;
}

export function buildImageSearchQueries(draft: AcceptedRawPostDraft) {
  return uniqueCleanStrings(
    [
      ...draft.imageQueries,
      ...draft.detectedPlayers,
      ...draft.detectedTeams,
      draft.title,
    ],
    3,
  );
}

export function buildInstagramCaption(input: {
  draft: AcceptedRawPostDraft;
  sourceName: string;
  sourceHandle?: string | null;
  originalUrl: string;
}) {
  const handle = input.sourceHandle ? `@${input.sourceHandle}` : input.sourceName;
  const hashtags = uniqueCleanStrings(input.draft.instagramHashtags, 12)
    .map((tag) => (tag.startsWith("#") ? tag : `#${tag.replace(/\s+/g, "")}`))
    .join(" ");

  return [
    input.draft.instagramCaption,
    "",
    `출처: ${input.sourceName} (${handle}) X 원문 ${input.originalUrl}`,
    "사진 출처: Wikimedia Commons",
    hashtags,
  ]
    .filter(Boolean)
    .join("\n");
}

export function buildTwoSlideCardNews(input: {
  draft: AcceptedRawPostDraft;
  sourceName: string;
  sourceHandle?: string | null;
  originalText: string;
  originalUrl: string;
  imageAssetId?: string;
}) {
  const handle = input.sourceHandle ? `@${input.sourceHandle}` : input.sourceName;

  return [
    {
      order: 1,
      templateType: "MAIN_IMAGE_TITLE_SUMMARY",
      headline: input.draft.cardTitle,
      body: input.draft.cardSummary,
      footnote: "Image: Wikimedia Commons",
      imageAssetId: input.imageAssetId,
    },
    {
      order: 2,
      templateType: "SOURCE_TWEET_CONTEXT",
      headline: "원문 및 출처",
      body: input.originalText,
      footnote: `${input.sourceName} (${handle}) · ${input.originalUrl}`,
      imageAssetId: undefined,
    },
  ];
}
