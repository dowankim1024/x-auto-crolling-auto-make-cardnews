import { acceptRawPost, AcceptRawPostError } from "@/lib/accept-raw-post";
import { OpenAIContentError } from "@/lib/openai-content";
import { WikimediaCommonsError } from "@/lib/wikimedia-commons";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;

  try {
    const result = await acceptRawPost(id);

    return Response.json(result);
  } catch (error) {
    if (error instanceof AcceptRawPostError) {
      return Response.json(
        {
          error: error.code,
          message: error.message,
        },
        { status: error.status },
      );
    }

    if (error instanceof OpenAIContentError || error instanceof WikimediaCommonsError) {
      return Response.json(
        {
          error: error.name,
          message: error.message,
        },
        { status: 502 },
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
