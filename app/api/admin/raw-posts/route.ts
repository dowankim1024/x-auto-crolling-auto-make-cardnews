import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import { parseCreateRawPostInput, RawPostInputError } from "@/lib/raw-posts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const rawPosts = await prisma.rawPost.findMany({
    orderBy: {
      createdAt: "desc",
    },
    take: 50,
    include: {
      sourceAccount: true,
      translation: true,
    },
  });

  return Response.json({ rawPosts });
}

export async function POST(request: Request) {
  try {
    const input = parseCreateRawPostInput(await request.json());
    const sourceAccount = input.sourceHandle
      ? await prisma.sourceAccount.upsert({
          where: {
            handle: input.sourceHandle,
          },
          create: {
            platform: "X",
            handle: input.sourceHandle,
            sportType: "UNKNOWN",
            sourceTier: 3,
          },
          update: {},
        })
      : undefined;

    const rawPost = await prisma.rawPost.create({
      data: {
        sourceAccountId: sourceAccount?.id,
        externalPostId: input.externalPostId,
        originalText: input.originalText,
        originalUrl: input.originalUrl,
        postedAt: input.postedAt,
        language: input.language,
        rawJson: {
          manualInput: true,
        },
      },
      include: {
        sourceAccount: true,
      },
    });

    return Response.json({ rawPost }, { status: 201 });
  } catch (error) {
    if (error instanceof RawPostInputError) {
      return Response.json(
        {
          error: "INVALID_INPUT",
          fieldErrors: error.fieldErrors,
        },
        { status: 400 },
      );
    }

    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2002"
    ) {
      return Response.json(
        {
          error: "DUPLICATE_RAW_POST",
          message: "이미 등록된 원문 URL입니다.",
        },
        { status: 409 },
      );
    }

    console.error(error);

    return Response.json(
      {
        error: "INTERNAL_SERVER_ERROR",
      },
      { status: 500 },
    );
  }
}
