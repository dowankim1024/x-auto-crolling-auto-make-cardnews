import {
  acceptedRawPostDraftSchema,
  buildAcceptedRawPostPrompt,
  type AcceptedRawPostDraft,
  type RawPostForDraft,
} from "@/lib/cardnews-pipeline";

type ChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string;
    };
  }>;
  error?: {
    message?: string;
  };
};

const responseSchema = {
  type: "json_schema",
  json_schema: {
    name: "accepted_raw_post_cardnews_draft",
    strict: true,
    schema: {
      type: "object",
      additionalProperties: false,
      required: [
        "translatedText",
        "oneLineSummary",
        "shortSummary",
        "detectedTeams",
        "detectedPlayers",
        "detectedKeywords",
        "postType",
        "suggestedRumorStatus",
        "riskFlags",
        "title",
        "subtitle",
        "summary",
        "body",
        "teamTags",
        "playerTags",
        "hashtags",
        "instagramCaption",
        "instagramHashtags",
        "cardTitle",
        "cardSummary",
        "imageQueries",
      ],
      properties: {
        translatedText: { type: "string" },
        oneLineSummary: { type: "string" },
        shortSummary: { type: "string" },
        detectedTeams: { type: "array", items: { type: "string" } },
        detectedPlayers: { type: "array", items: { type: "string" } },
        detectedKeywords: { type: "array", items: { type: "string" } },
        postType: { type: "string", enum: ["GENERAL", "POLL", "TODAY_DEBATE"] },
        suggestedRumorStatus: { type: "string" },
        riskFlags: { type: "array", items: { type: "string" } },
        title: { type: "string" },
        subtitle: { type: "string" },
        summary: { type: "string" },
        body: { type: "string" },
        teamTags: { type: "array", items: { type: "string" } },
        playerTags: { type: "array", items: { type: "string" } },
        hashtags: { type: "array", items: { type: "string" } },
        instagramCaption: { type: "string" },
        instagramHashtags: { type: "array", items: { type: "string" } },
        cardTitle: { type: "string" },
        cardSummary: { type: "string" },
        imageQueries: { type: "array", minItems: 1, maxItems: 5, items: { type: "string" } },
      },
    },
  },
} as const;

export class OpenAIContentError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OpenAIContentError";
  }
}

export async function generateAcceptedRawPostDraft(
  rawPost: RawPostForDraft,
): Promise<AcceptedRawPostDraft> {
  const apiKey = process.env.OPENAI_API_KEY;
  const model = process.env.OPENAI_MODEL;

  if (!apiKey) {
    throw new OpenAIContentError("OPENAI_API_KEY is required.");
  }

  if (!model) {
    throw new OpenAIContentError("OPENAI_MODEL is required.");
  }

  const response = await fetch("https://api.openai.com/v1/chat/completions", {
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
            "You are a careful Korean sports editor creating concise Instagram card news drafts.",
        },
        {
          role: "user",
          content: buildAcceptedRawPostPrompt(rawPost),
        },
      ],
      response_format: responseSchema,
    }),
  });

  const payload = (await response.json()) as ChatCompletionResponse;

  if (!response.ok) {
    throw new OpenAIContentError(
      payload.error?.message ?? `OpenAI request failed with ${response.status}.`,
    );
  }

  const content = payload.choices?.[0]?.message?.content;

  if (!content) {
    throw new OpenAIContentError("OpenAI response did not include content.");
  }

  return acceptedRawPostDraftSchema.parse(JSON.parse(content));
}
