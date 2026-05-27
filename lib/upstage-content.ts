import {
  buildFootballBriefingPrompt,
  buildFootballBriefingGroundingPrompt,
  buildFootballTagClassificationPrompt,
  footballBriefingSchema,
  footballBriefingStatusSchema,
  footballTagClassificationSchema,
  type FootballBriefing,
  type FootballTagClassification,
} from "@/lib/football-briefing";

type UpstageChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

export type RawPostForFootballBriefing = {
  originalText: string;
  originalUrl: string;
  postedAt: Date;
  sourceAccount?: {
    handle?: string | null;
    displayName?: string | null;
  } | null;
};

export class UpstageContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "UpstageContentError";
  }
}

export async function generateFootballBriefing(
  rawPost: RawPostForFootballBriefing,
): Promise<FootballBriefing> {
  const apiKey = process.env.UPSTAGE_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = process.env.UPSTAGE_MODEL ?? "solar-pro3";
  const baseUrl = process.env.UPSTAGE_BASE_URL ?? "https://api.upstage.ai/v1";

  if (!apiKey) {
    throw new UpstageContentError("UPSTAGE_API_KEY is required.");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You write Korean football briefings and return JSON only. Never add facts outside the original tweet.",
        },
        {
          role: "user",
          content: buildFootballBriefingPrompt({
            originalText: rawPost.originalText,
            originalUrl: rawPost.originalUrl,
            postedAt: rawPost.postedAt,
            sourceHandle: rawPost.sourceAccount?.handle,
            sourceName: rawPost.sourceAccount?.displayName,
          }),
        },
      ],
      temperature: 0.2,
    }),
  });

  const payload = (await response.json()) as UpstageChatCompletionResponse;

  if (!response.ok) {
    throw new UpstageContentError(
      payload.error?.message ?? `Upstage request failed with ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new UpstageContentError("Upstage response did not include content.");
  }

  return parseFootballBriefingContent(content);
}

export async function classifyFootballTeamTags(
  rawPost: RawPostForFootballBriefing,
): Promise<FootballTagClassification> {
  const apiKey = process.env.UPSTAGE_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = process.env.UPSTAGE_MODEL ?? "solar-pro3";
  const baseUrl = process.env.UPSTAGE_BASE_URL ?? "https://api.upstage.ai/v1";

  if (!apiKey) {
    throw new UpstageContentError("UPSTAGE_API_KEY is required.");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a football entity classifier. Return JSON only and include all clearly connected EPL Big 6 tags.",
        },
        {
          role: "user",
          content: buildFootballTagClassificationPrompt({
            originalText: rawPost.originalText,
            originalUrl: rawPost.originalUrl,
            postedAt: rawPost.postedAt,
            sourceHandle: rawPost.sourceAccount?.handle,
            sourceName: rawPost.sourceAccount?.displayName,
          }),
        },
      ],
      temperature: 0,
    }),
  });

  const payload = (await response.json()) as UpstageChatCompletionResponse;

  if (!response.ok) {
    throw new UpstageContentError(
      payload.error?.message ?? `Upstage request failed with ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new UpstageContentError("Upstage response did not include content.");
  }

  return parseFootballTagClassificationContent(content);
}

export async function groundFootballBriefingInOriginalText(input: {
  originalText: string;
  draft: FootballBriefing;
}): Promise<FootballBriefing> {
  const apiKey = process.env.UPSTAGE_API_KEY ?? process.env.OPENAI_API_KEY;
  const model = process.env.UPSTAGE_MODEL ?? "solar-pro3";
  const baseUrl = process.env.UPSTAGE_BASE_URL ?? "https://api.upstage.ai/v1";

  if (!apiKey) {
    throw new UpstageContentError("UPSTAGE_API_KEY is required.");
  }

  const response = await fetch(`${baseUrl.replace(/\/+$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      messages: [
        {
          role: "system",
          content:
            "You are a strict factuality editor. Return JSON only and remove unsupported facts.",
        },
        {
          role: "user",
          content: buildFootballBriefingGroundingPrompt(input),
        },
      ],
      temperature: 0,
    }),
  });

  const payload = (await response.json()) as UpstageChatCompletionResponse;

  if (!response.ok) {
    throw new UpstageContentError(
      payload.error?.message ?? `Upstage request failed with ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new UpstageContentError("Upstage response did not include content.");
  }

  return parseGroundedFootballBriefingContent(content, input.draft);
}

export function parseFootballBriefingContent(content: string): FootballBriefing {
  try {
    return footballBriefingSchema.parse(JSON.parse(stripJsonFence(content)));
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UpstageContentError("Upstage response was not valid JSON.");
    }

    throw error;
  }
}

function parseGroundedFootballBriefingContent(
  content: string,
  draft: FootballBriefing,
): FootballBriefing {
  try {
    const parsed = JSON.parse(stripJsonFence(content));

    return footballBriefingSchema.parse({
      ...parsed,
      tags: draft.tags,
      status: footballBriefingStatusSchema.safeParse(parsed.status).success
        ? parsed.status
        : draft.status,
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UpstageContentError("Upstage response was not valid JSON.");
    }

    throw error;
  }
}

export function parseFootballTagClassificationContent(
  content: string,
): FootballTagClassification {
  try {
    const parsed = JSON.parse(stripJsonFence(content));

    return footballTagClassificationSchema.parse({
      ...parsed,
      tags: normalizeFootballTeamTagValues(parsed.tags),
    });
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new UpstageContentError("Upstage response was not valid JSON.");
    }

    throw error;
  }
}

function normalizeFootballTeamTagValues(values: unknown): string[] {
  if (!Array.isArray(values)) {
    return [];
  }

  const tags: string[] = [];

  for (const value of values) {
    const tag = normalizeFootballTeamTagValue(value);

    if (tag && !tags.includes(tag)) {
      tags.push(tag);
    }
  }

  return tags;
}

function normalizeFootballTeamTagValue(value: unknown) {
  if (typeof value !== "string") {
    return undefined;
  }

  const normalized = value.trim().toLowerCase().replace(/[^a-z0-9]+/g, " ");

  if (["ars", "arsenal", "gunners"].includes(normalized)) return "ARS";
  if (["che", "chelsea", "blues"].includes(normalized)) return "CHE";
  if (["liv", "liverpool", "reds"].includes(normalized)) return "LIV";
  if (["mci", "manchester city", "man city", "mcfc", "city"].includes(normalized)) {
    return "MCI";
  }
  if (
    ["mun", "manchester united", "man united", "man utd", "mufc", "united"].includes(
      normalized,
    )
  ) {
    return "MUN";
  }
  if (["tot", "tottenham", "tottenham hotspur", "spurs"].includes(normalized)) {
    return "TOT";
  }

  return undefined;
}

function stripJsonFence(content: string) {
  return content
    .trim()
    .replace(/^```(?:json)?\s*/i, "")
    .replace(/\s*```$/i, "");
}
