import { z } from "zod";

const rawPostInputSchema = z.object({
  sourceHandle: z
    .string()
    .trim()
    .optional()
    .transform((value) => normalizeHandle(value)),
  originalText: z.string().trim().min(1, "원문을 입력하세요."),
  originalUrl: z.string().trim().url("올바른 URL을 입력하세요."),
  postedAt: z
    .string()
    .trim()
    .optional()
    .transform((value) => parsePostedAt(value)),
  language: z
    .string()
    .trim()
    .optional()
    .transform((value) => (value ? value.toLowerCase() : undefined)),
});

export type CreateRawPostInput = {
  sourceHandle?: string;
  externalPostId: string;
  originalText: string;
  originalUrl: string;
  postedAt: Date;
  language?: string;
};

export class RawPostInputError extends Error {
  constructor(
    message: string,
    public readonly fieldErrors: Record<string, string[] | undefined>,
  ) {
    super(message);
    this.name = "RawPostInputError";
  }
}

export function parseCreateRawPostInput(input: unknown): CreateRawPostInput {
  const result = rawPostInputSchema.safeParse(input);

  if (!result.success) {
    throw new RawPostInputError(
      "RawPost input validation failed.",
      result.error.flatten().fieldErrors,
    );
  }

  return {
    ...result.data,
    externalPostId: buildExternalPostId(result.data.originalUrl),
  };
}

function normalizeHandle(value: string | undefined): string | undefined {
  if (!value) {
    return undefined;
  }

  const normalized = value.replace(/^@+/, "").trim();
  return normalized.length > 0 ? normalized : undefined;
}

function parsePostedAt(value: string | undefined): Date {
  if (!value) {
    return new Date();
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    throw new Error("Invalid postedAt.");
  }

  return date;
}

function buildExternalPostId(originalUrl: string): string {
  const url = new URL(originalUrl);
  const statusId = extractXStatusId(url);

  if (statusId) {
    return `x-manual-${statusId}`;
  }

  return `manual-${slugifyUrl(url)}`;
}

function extractXStatusId(url: URL): string | undefined {
  const host = url.hostname.replace(/^www\./, "").toLowerCase();

  if (host !== "x.com" && host !== "twitter.com") {
    return undefined;
  }

  const segments = url.pathname.split("/").filter(Boolean);
  const statusIndex = segments.findIndex((segment) => segment === "status");

  if (statusIndex === -1) {
    return undefined;
  }

  return segments[statusIndex + 1];
}

function slugifyUrl(url: URL): string {
  return `${url.protocol}//${url.hostname}${url.pathname}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 96);
}
