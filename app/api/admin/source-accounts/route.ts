import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseSourceAccountInput,
  SourceAccountInputError,
} from "@/lib/source-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const sourceAccounts = await prisma.sourceAccount.findMany({
    orderBy: [
      { platform: "asc" },
      { sourceTier: "asc" },
      { handle: "asc" },
    ],
    include: {
      _count: {
        select: {
          rawPosts: true,
        },
      },
    },
  });

  return Response.json({ sourceAccounts });
}

export async function POST(request: Request) {
  try {
    const input = parseSourceAccountInput(await request.json());

    const sourceAccount = await prisma.sourceAccount.create({
      data: {
        platform: input.platform,
        handle: input.handle,
        displayName: input.displayName,
        sportType: input.sportType,
        sourceTier: input.sourceTier,
        isActive: input.isActive,
      },
    });

    return Response.json({ sourceAccount }, { status: 201 });
  } catch (error) {
    if (error instanceof SourceAccountInputError) {
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
          error: "DUPLICATE_SOURCE_ACCOUNT",
          message: "이미 등록된 계정 핸들입니다.",
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
