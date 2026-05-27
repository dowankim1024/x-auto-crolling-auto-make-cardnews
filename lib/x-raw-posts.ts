import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { ParsedStreamTweet } from "@/lib/x-stream";

export type SaveStreamTweetResult =
  | { status: "created"; rawPostId: string }
  | { status: "duplicate" };

export async function saveStreamTweetAsRawPost(
  tweet: ParsedStreamTweet,
): Promise<SaveStreamTweetResult> {
  try {
    const sourceAccount = tweet.sourceHandle
      ? await prisma.sourceAccount.findUnique({
          where: {
            handle: tweet.sourceHandle,
          },
        })
      : null;

    const rawPost = await prisma.rawPost.create({
      data: {
        sourceAccountId: sourceAccount?.id,
        externalPostId: tweet.externalPostId,
        originalText: tweet.originalText,
        originalUrl: tweet.originalUrl,
        postedAt: tweet.postedAt,
        language: tweet.language,
        rawJson: tweet.rawJson,
      },
    });

    return {
      status: "created",
      rawPostId: rawPost.id,
    };
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return { status: "duplicate" };
    }

    throw error;
  }
}
