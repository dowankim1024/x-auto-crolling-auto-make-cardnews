import { Prisma } from "@/lib/generated/prisma/client";
import { prisma } from "@/lib/prisma";
import {
  parseSourceAccountInput,
  SourceAccountInputError,
} from "@/lib/source-accounts";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

type RouteContext = {
  params: Promise<{
    id: string;
  }>;
};

export async function PATCH(request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;
    const input = parseSourceAccountInput(await request.json());

    const sourceAccount = await prisma.sourceAccount.update({
      where: { id },
      data: {
        platform: input.platform,
        handle: input.handle,
        displayName: input.displayName,
        sportType: input.sportType,
        sourceTier: input.sourceTier,
        isActive: input.isActive,
      },
    });

    return Response.json({ sourceAccount });
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
      error.code === "P2025"
    ) {
      return Response.json(
        {
          error: "NOT_FOUND",
          message: "SourceAccount를 찾을 수 없습니다.",
        },
        { status: 404 },
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

export async function DELETE(_request: Request, context: RouteContext) {
  try {
    const { id } = await context.params;

    await prisma.sourceAccount.delete({
      where: { id },
    });

    return Response.json({ ok: true });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === "P2025"
    ) {
      return Response.json(
        {
          error: "NOT_FOUND",
          message: "SourceAccount를 찾을 수 없습니다.",
        },
        { status: 404 },
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
