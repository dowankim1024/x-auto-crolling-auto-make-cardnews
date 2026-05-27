import { Prisma } from "@/lib/generated/prisma/client";
import {
  applyBigSixEvidenceGuard,
  applySourceTextCorrections,
  decideFootballBriefingRoute,
  mergeFootballBriefingTags,
  type FootballBriefing,
  type FootballBriefingDecision,
} from "@/lib/football-briefing";
import { prisma } from "@/lib/prisma";
import { sendPublishSlackMessage, sendReviewSlackMessage } from "@/lib/slack";
import {
  classifyFootballTeamTags,
  generateFootballBriefing,
  groundFootballBriefingInOriginalText,
} from "@/lib/upstage-content";

type ProcessFootballBriefingResult =
  | {
      route: "AUTO_PUBLISH";
      rawPostId: string;
      aiBriefingId: string;
      publishItemId: string;
      briefing: FootballBriefing;
      decision: FootballBriefingDecision;
    }
  | {
      route: "REVIEW_QUEUE";
      rawPostId: string;
      aiBriefingId: string;
      reviewItemId: string;
      briefing: FootballBriefing;
      decision: FootballBriefingDecision;
    }
  | {
      route: "IGNORE";
      rawPostId: string;
      aiBriefingId: string;
      briefing: FootballBriefing;
      decision: FootballBriefingDecision;
    };

export class FootballBriefingPipelineError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FootballBriefingPipelineError";
  }
}

export async function processRawPostWithAi(
  rawPostId: string,
): Promise<ProcessFootballBriefingResult> {
  const rawPost = await prisma.rawPost.findUnique({
    where: {
      id: rawPostId,
    },
    include: {
      sourceAccount: true,
    },
  });

  if (!rawPost) {
    throw new FootballBriefingPipelineError("RawPost not found.");
  }

  await prisma.rawPost.update({
    where: {
      id: rawPost.id,
    },
    data: {
      status: "TRANSLATING",
    },
  });

  try {
    const [generatedBriefing, tagClassification] = await Promise.all([
      generateFootballBriefing(rawPost),
      classifyFootballTeamTags(rawPost),
    ]);
    const groundedBriefing = await groundFootballBriefingInOriginalText({
      originalText: rawPost.originalText,
      draft: generatedBriefing,
    });
    const briefing = applySourceTextCorrections(
      applyBigSixEvidenceGuard(
        mergeFootballBriefingTags(groundedBriefing, tagClassification.tags),
        rawPost.originalText,
      ),
      rawPost.originalText,
    );
    const decision = decideFootballBriefingRoute(briefing, {
      originalText: rawPost.originalText,
    });
    const model = process.env.UPSTAGE_MODEL ?? "solar-pro3";

    const result = await prisma.$transaction(async (tx) => {
      const aiBriefing = await tx.aiBriefing.upsert({
        where: {
          rawPostId: rawPost.id,
        },
        create: {
          rawPostId: rawPost.id,
          title: briefing.title,
          summaryShort: briefing.summary_short,
          summaryDetail: briefing.summary_detail,
          teamTags: briefing.tags,
          briefingStatus: briefing.status,
          route: decision.route,
          decisionReason: decision.reason,
          aiModel: model,
          aiRawResponse: briefing,
          processingStatus: "COMPLETED",
        },
        update: {
          title: briefing.title,
          summaryShort: briefing.summary_short,
          summaryDetail: briefing.summary_detail,
          teamTags: briefing.tags,
          briefingStatus: briefing.status,
          route: decision.route,
          decisionReason: decision.reason,
          aiModel: model,
          aiRawResponse: briefing,
          processingStatus: "COMPLETED",
          errorMessage: null,
        },
      });

      if (decision.route === "IGNORE") {
        await tx.rawPost.update({
          where: {
            id: rawPost.id,
          },
          data: {
            status: "IGNORED",
          },
        });

        return {
          route: decision.route,
          rawPostId: rawPost.id,
          aiBriefingId: aiBriefing.id,
          briefing,
          decision,
        };
      }

      if (decision.route === "AUTO_PUBLISH") {
        const publishItem = await tx.publishQueueItem.upsert({
          where: {
            aiBriefingId: aiBriefing.id,
          },
          create: {
            aiBriefingId: aiBriefing.id,
            status: "READY",
            title: briefing.title,
            summaryShort: briefing.summary_short,
            summaryDetail: briefing.summary_detail,
            teamTags: briefing.tags,
            briefingStatus: briefing.status,
          },
          update: {
            status: "READY",
            title: briefing.title,
            summaryShort: briefing.summary_short,
            summaryDetail: briefing.summary_detail,
            teamTags: briefing.tags,
            briefingStatus: briefing.status,
            errorMessage: null,
          },
        });

        await tx.rawPost.update({
          where: {
            id: rawPost.id,
          },
          data: {
            status: "TRANSLATED",
          },
        });

        return {
          route: decision.route,
          rawPostId: rawPost.id,
          aiBriefingId: aiBriefing.id,
          publishItemId: publishItem.id,
          briefing,
          decision,
        };
      }

      const reviewItem = await tx.reviewQueueItem.upsert({
        where: {
          aiBriefingId: aiBriefing.id,
        },
        create: {
          aiBriefingId: aiBriefing.id,
          status: "PENDING",
          reason: decision.reason,
          title: briefing.title,
          summaryShort: briefing.summary_short,
          summaryDetail: briefing.summary_detail,
          teamTags: briefing.tags,
          briefingStatus: briefing.status,
        },
        update: {
          status: "PENDING",
          reason: decision.reason,
          title: briefing.title,
          summaryShort: briefing.summary_short,
          summaryDetail: briefing.summary_detail,
          teamTags: briefing.tags,
          briefingStatus: briefing.status,
          reviewedAt: null,
          reviewedBy: null,
        },
      });

      await tx.rawPost.update({
        where: {
          id: rawPost.id,
        },
        data: {
          status: "TRANSLATED",
        },
      });

      return {
        route: decision.route,
        rawPostId: rawPost.id,
        aiBriefingId: aiBriefing.id,
        reviewItemId: reviewItem.id,
        briefing,
        decision,
      };
    });

    await notifyRoute(result, rawPost.originalUrl);

    return result;
  } catch (error) {
    await prisma.$transaction(async (tx) => {
      await tx.rawPost.update({
        where: {
          id: rawPost.id,
        },
        data: {
          status: "ERROR",
          rawJson:
            rawPost.rawJson && typeof rawPost.rawJson === "object" && !Array.isArray(rawPost.rawJson)
              ? {
                  ...(rawPost.rawJson as Prisma.JsonObject),
                  aiProcessingError:
                    error instanceof Error ? error.message : "Unknown AI processing error.",
                }
              : {
                  previousRawJson: rawPost.rawJson ?? null,
                  aiProcessingError:
                    error instanceof Error ? error.message : "Unknown AI processing error.",
                },
        },
      });
    });

    await sendReviewSlackMessage(
      [
        "[AI 처리 실패]",
        `원문: ${rawPost.originalUrl}`,
        `오류: ${error instanceof Error ? error.message : "Unknown AI processing error."}`,
        `어드민: ${process.env.APP_BASE_URL ?? "http://localhost:3000"}/admin/raw-posts`,
      ].join("\n"),
    );

    throw error;
  }
}

async function notifyRoute(
  result: ProcessFootballBriefingResult,
  originalUrl: string,
) {
  if (result.route === "IGNORE") {
    return;
  }

  const adminUrl =
    result.route === "AUTO_PUBLISH"
      ? `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/admin/publish-queue`
      : `${process.env.APP_BASE_URL ?? "http://localhost:3000"}/admin/review-queue`;

  const message = [
    result.route === "AUTO_PUBLISH" ? "[자동 발행 큐 등록]" : "[검수 큐 등록]",
    `제목: ${result.briefing.title}`,
    `태그: ${result.briefing.tags.join(", ")}`,
    `상태: ${result.briefing.status}`,
    `사유: ${result.decision.reason}`,
    `요약: ${result.briefing.summary_short}`,
    `원문: ${originalUrl}`,
    `어드민: ${adminUrl}`,
  ].join("\n");

  if (result.route === "AUTO_PUBLISH") {
    await sendPublishSlackMessage(message);
    return;
  }

  await sendReviewSlackMessage(message);
}
