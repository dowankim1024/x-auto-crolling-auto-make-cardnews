import { z } from "zod";

const metadataValueSchema = z.object({
  value: z.string().optional(),
});

const imageInfoSchema = z.object({
  url: z.string().url().optional(),
  thumburl: z.string().url().optional(),
  descriptionshorturl: z.string().url().optional(),
  extmetadata: z
    .object({
      LicenseShortName: metadataValueSchema.optional(),
      LicenseUrl: metadataValueSchema.optional(),
      UsageTerms: metadataValueSchema.optional(),
      Artist: metadataValueSchema.optional(),
      Credit: metadataValueSchema.optional(),
      ObjectName: metadataValueSchema.optional(),
      ImageDescription: metadataValueSchema.optional(),
    })
    .optional(),
});

const pageSchema = z.object({
  pageid: z.number().optional(),
  title: z.string(),
  imageinfo: z.array(imageInfoSchema).optional(),
});

const commonsSearchResponseSchema = z.object({
  query: z.object({
    pages: z.record(z.string(), pageSchema).default({}),
  }),
});

export type WikimediaCommonsImageCandidate = {
  providerAssetId: string;
  title?: string;
  imageUrl: string;
  thumbnailUrl?: string;
  sourcePageUrl?: string;
  authorName?: string;
  licenseName: string;
  licenseUrl?: string;
  creditText: string;
  licenseSafety: "SAFE_NO_RESTRICTIONS" | "SAFE_WITH_ATTRIBUTION" | "REVIEW_SAME_LICENSE";
  commercialUseAllowed: boolean;
  modificationAllowed: boolean;
  requiresAttribution: boolean;
  requiresShareAlike: boolean;
  tags: string[];
};

export class WikimediaCommonsError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "WikimediaCommonsError";
  }
}

function stripHtml(value?: string) {
  return value
    ?.replace(/<[^>]*>/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export function classifyCommonsLicense(licenseName?: string) {
  const license = licenseName?.toLowerCase().trim() ?? "";

  if (
    !license ||
    license.includes("noncommercial") ||
    license.includes("no derivatives") ||
    license.includes("cc by-nc") ||
    license.includes("cc-by-nc") ||
    license.includes("cc by-nd") ||
    license.includes("cc-by-nd")
  ) {
    return null;
  }

  if (
    license.includes("cc0") ||
    license.includes("public domain") ||
    license === "pd" ||
    license.includes("pdm")
  ) {
    return {
      licenseSafety: "SAFE_NO_RESTRICTIONS" as const,
      commercialUseAllowed: true,
      modificationAllowed: true,
      requiresAttribution: false,
      requiresShareAlike: false,
    };
  }

  if (license.includes("cc by-sa")) {
    return {
      licenseSafety: "REVIEW_SAME_LICENSE" as const,
      commercialUseAllowed: true,
      modificationAllowed: true,
      requiresAttribution: true,
      requiresShareAlike: true,
    };
  }

  if (license.includes("cc by")) {
    return {
      licenseSafety: "SAFE_WITH_ATTRIBUTION" as const,
      commercialUseAllowed: true,
      modificationAllowed: true,
      requiresAttribution: true,
      requiresShareAlike: false,
    };
  }

  return null;
}

export function normalizeCommonsImageCandidate(
  page: z.infer<typeof pageSchema>,
): WikimediaCommonsImageCandidate | null {
  const imageInfo = page.imageinfo?.[0];

  if (!imageInfo?.url) {
    return null;
  }

  const metadata = imageInfo.extmetadata;
  const licenseName = stripHtml(
    metadata?.LicenseShortName?.value ?? metadata?.UsageTerms?.value,
  );
  const license = classifyCommonsLicense(licenseName);

  if (!license || !licenseName) {
    return null;
  }

  const authorName = stripHtml(metadata?.Artist?.value ?? metadata?.Credit?.value);
  const objectName =
    stripHtml(metadata?.ObjectName?.value) ??
    page.title.replace(/^File:/, "").replace(/\.[a-z0-9]+$/i, "");
  const sourcePageUrl =
    imageInfo.descriptionshorturl ??
    `https://commons.wikimedia.org/wiki/${encodeURIComponent(page.title).replace(/%20/g, "_")}`;

  return {
    providerAssetId: String(page.pageid ?? page.title),
    title: objectName,
    imageUrl: imageInfo.url,
    thumbnailUrl: imageInfo.thumburl,
    sourcePageUrl,
    authorName,
    licenseName,
    licenseUrl: metadata?.LicenseUrl?.value,
    creditText: ["Image: Wikimedia Commons", objectName, authorName, licenseName]
      .filter(Boolean)
      .join(" / "),
    tags: [licenseName, authorName].filter((value): value is string => Boolean(value)),
    ...license,
  };
}

export async function searchWikimediaCommonsImages(
  phrase: string,
  limit = 3,
): Promise<WikimediaCommonsImageCandidate[]> {
  const baseUrl =
    process.env.WIKIMEDIA_COMMONS_API_BASE_URL ??
    "https://commons.wikimedia.org/w/api.php";
  const url = new URL(baseUrl);

  url.searchParams.set("action", "query");
  url.searchParams.set("format", "json");
  url.searchParams.set("origin", "*");
  url.searchParams.set("generator", "search");
  url.searchParams.set("gsrnamespace", "6");
  url.searchParams.set("gsrsearch", `filetype:bitmap ${phrase}`);
  url.searchParams.set("gsrlimit", String(Math.max(limit * 4, 12)));
  url.searchParams.set("prop", "imageinfo");
  url.searchParams.set("iiprop", "url|extmetadata");
  url.searchParams.set("iiurlwidth", "1200");

  const response = await fetch(url, {
    headers: {
      "User-Agent":
        process.env.WIKIMEDIA_COMMONS_USER_AGENT ??
        "x-cardnews-admin/0.1 (local development)",
    },
  });
  const payload = await response.json();

  if (!response.ok) {
    throw new WikimediaCommonsError(
      payload?.error?.info ?? `Wikimedia Commons request failed with ${response.status}.`,
    );
  }

  const parsed = commonsSearchResponseSchema.parse(payload);

  return Object.values(parsed.query.pages)
    .map(normalizeCommonsImageCandidate)
    .filter((image): image is WikimediaCommonsImageCandidate => Boolean(image))
    .slice(0, limit);
}
