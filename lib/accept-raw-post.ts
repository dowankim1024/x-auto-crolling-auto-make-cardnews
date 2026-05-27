import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  buildImageSearchQueries,
  buildInstagramCaption,
  buildTwoSlideCardNews,
} from "@/lib/cardnews-pipeline";
import { generateAcceptedRawPostDraft } from "@/lib/openai-content";
import {
  searchWikimediaCommonsImages,
  type WikimediaCommonsImageCandidate,
} from "@/lib/wikimedia-commons";

export class AcceptRawPostError extends Error {
  status: number;
  code: string;

  constructor(code: string, message: string, status = 500) {
    super(message);
    this.name = "AcceptRawPostError";
    this.code = code;
    this.status = status;
  }
}

export async function acceptRawPost(rawPostId: string) {
  const rawPost = await prisma.rawPost.findUnique({
    where: {
      id: rawPostId,
    },
    include: {
      sourceAccount: true,
      translation: true,
      articleDrafts: {
        orderBy: {
          createdAt: "desc",
        },
        take: 1,
        include: {
          cardNewsDrafts: {
            orderBy: {
              createdAt: "desc",
            },
            take: 1,
            include: {
              slides: {
                orderBy: {
                  order: "asc",
                },
              },
            },
          },
        },
      },
    },
  });

  if (!rawPost) {
    throw new AcceptRawPostError("RAW_POST_NOT_FOUND", "원문을 찾을 수 없습니다.", 404);
  }

  const existingArticleDraft = rawPost.articleDrafts[0];
  const existingCardNewsDraft = existingArticleDraft?.cardNewsDrafts[0];

  if (rawPost.translation && existingArticleDraft && existingCardNewsDraft) {
    return {
      rawPost,
      translation: rawPost.translation,
      articleDraft: existingArticleDraft,
      cardNewsDraft: existingCardNewsDraft,
      imageAssets: [],
      reused: true,
    };
  }

  if (!process.env.OPENAI_API_KEY) {
    throw new AcceptRawPostError(
      "OPENAI_API_KEY_MISSING",
      "OPENAI_API_KEY is required.",
      500,
    );
  }

  if (!process.env.OPENAI_MODEL) {
    throw new AcceptRawPostError(
      "OPENAI_MODEL_MISSING",
      "OPENAI_MODEL is required.",
      500,
    );
  }

  await prisma.rawPost.update({
    where: {
      id: rawPost.id,
    },
    data: {
      status: "ACCEPTED",
    },
  });

  try {
    const sourceName =
      rawPost.sourceAccount?.displayName ??
      rawPost.sourceAccount?.handle ??
      "Unknown X source";
    const sourceHandle = rawPost.sourceAccount?.handle;
    const draft = await generateAcceptedRawPostDraft(rawPost);
    const imageQueries = buildImageSearchQueries(draft);
    const imageCandidates: WikimediaCommonsImageCandidate[] = [];

    for (const query of imageQueries) {
      const candidates = await searchWikimediaCommonsImages(query, 3);

      for (const candidate of candidates) {
        if (
          imageCandidates.some(
            (existing) => existing.providerAssetId === candidate.providerAssetId,
          )
        ) {
          continue;
        }

        imageCandidates.push(candidate);

        if (imageCandidates.length >= 3) {
          break;
        }
      }

      if (imageCandidates.length >= 3) {
        break;
      }
    }

    const translationData = {
      translatedText: draft.translatedText,
      oneLineSummary: draft.oneLineSummary,
      shortSummary: draft.shortSummary,
      detectedTeams: draft.detectedTeams,
      detectedPlayers: draft.detectedPlayers,
      detectedKeywords: draft.detectedKeywords,
      suggestedPostType: draft.postType,
      suggestedRumorStatus: draft.suggestedRumorStatus,
      riskFlags: draft.riskFlags,
    };

    const caption = buildInstagramCaption({
      draft,
      sourceName,
      sourceHandle,
      originalUrl: rawPost.originalUrl,
    });

    const result = await prisma.$transaction(async (tx) => {
      const translation = await tx.translatedPost.upsert({
        where: {
          rawPostId: rawPost.id,
        },
        create: {
          rawPostId: rawPost.id,
          ...translationData,
        },
        update: translationData,
      });

      const articleDraft = await tx.articleDraft.create({
        data: {
          rawPostId: rawPost.id,
          postType: draft.postType,
          title: draft.title,
          subtitle: draft.subtitle,
          summary: draft.summary,
          body: draft.body,
          sourceName,
          sourceUrl: rawPost.originalUrl,
          rumorStatus: draft.suggestedRumorStatus,
          teamTags: draft.teamTags,
          playerTags: draft.playerTags,
          hashtags: draft.hashtags,
          status: "REVIEW",
        },
      });

      const imageAssets = await Promise.all(
        imageCandidates.map((candidate) =>
          tx.imageAsset.create({
            data: {
              provider: "WIKIMEDIA_COMMONS",
              providerAssetId: candidate.providerAssetId,
              title: candidate.title,
              imageUrl: candidate.imageUrl,
              thumbnailUrl: candidate.thumbnailUrl,
              sourcePageUrl: candidate.sourcePageUrl,
              authorName: candidate.authorName,
              licenseName: candidate.licenseName,
              licenseUrl: candidate.licenseUrl,
              creditText: candidate.creditText,
              licenseSafety: candidate.licenseSafety,
              commercialUseAllowed: candidate.commercialUseAllowed,
              modificationAllowed: candidate.modificationAllowed,
              requiresAttribution: candidate.requiresAttribution,
              requiresShareAlike: candidate.requiresShareAlike,
              usageAllowed: true,
              adminApproved: false,
              tags: candidate.tags,
            },
          }),
        ),
      );

      const cardNewsDraft = await tx.cardNewsDraft.create({
        data: {
          articleDraftId: articleDraft.id,
          title: draft.cardTitle,
          caption,
          instagramHashtags: draft.instagramHashtags,
          status: imageAssets.length > 0 ? "READY_TO_RENDER" : "IMAGE_PENDING",
          slides: {
            create: buildTwoSlideCardNews({
              draft,
              sourceName,
              sourceHandle,
              originalText: rawPost.originalText,
              originalUrl: rawPost.originalUrl,
              imageAssetId: imageAssets[0]?.id,
            }),
          },
        },
        include: {
          slides: {
            orderBy: {
              order: "asc",
            },
          },
        },
      });

      const updatedRawPost = await tx.rawPost.update({
        where: {
          id: rawPost.id,
        },
        data: {
          status: "TRANSLATED",
        },
        include: {
          sourceAccount: true,
        },
      });

      return {
        rawPost: updatedRawPost,
        translation,
        articleDraft,
        cardNewsDraft,
        imageAssets,
        reused: false,
      };
    });

    return result;
  } catch (error) {
    await prisma.rawPost.update({
      where: {
        id: rawPost.id,
      },
      data: {
        status: "ERROR",
        rawJson:
          rawPost.rawJson && typeof rawPost.rawJson === "object" && !Array.isArray(rawPost.rawJson)
            ? {
                ...(rawPost.rawJson as Prisma.JsonObject),
                acceptError:
                  error instanceof Error ? error.message : "Unknown accept pipeline error.",
              }
            : {
                previousRawJson: rawPost.rawJson ?? null,
                acceptError:
                  error instanceof Error ? error.message : "Unknown accept pipeline error.",
              },
      },
    });

    throw error;
  }
}
