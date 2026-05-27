import { loadEnvConfig } from "@next/env";

import type { XApiClient } from "@/lib/x-api";
import type { ParsedStreamTweet, StreamTweetPayload } from "@/lib/x-stream";

loadEnvConfig(process.cwd());

type StreamWorkerDependencies = {
  parseStreamTweetPayload: (payload: StreamTweetPayload) => ParsedStreamTweet;
  saveStreamTweetAsRawPost: (
    tweet: ParsedStreamTweet,
  ) => Promise<{ status: "created"; rawPostId: string } | { status: "duplicate" }>;
  processRawPostWithAi: (rawPostId: string) => Promise<unknown>;
};

let shouldStop = false;

process.on("SIGINT", () => {
  shouldStop = true;
});

process.on("SIGTERM", () => {
  shouldStop = true;
});

main().catch((error) => {
  console.error(error);
  process.exit(1);
});

async function main() {
  const { createXApiClientFromEnv } = await import("@/lib/x-api");
  const {
    getActiveXSourceAccounts,
    syncConfiguredXSourceAccounts,
  } = await import("@/lib/x-source-accounts");
  const { saveStreamTweetAsRawPost } = await import("@/lib/x-raw-posts");
  const { parseStreamTweetPayload } = await import("@/lib/x-stream");
  const { processRawPostWithAi } = await import("@/lib/football-briefing-pipeline");
  const { prisma } = await import("@/lib/prisma");

  try {
    await syncConfiguredXSourceAccounts();
    const accounts = await getActiveXSourceAccounts();
    const client = createXApiClientFromEnv();
    const rule = await client.syncWatchedAccountRule(accounts);

    console.log(`X stream rule: ${rule.ruleValue}`);
    console.log("Connecting to X filtered stream...");

    while (!shouldStop) {
      try {
        await consumeStream(client, {
          parseStreamTweetPayload,
          saveStreamTweetAsRawPost,
          processRawPostWithAi,
        });
      } catch (error) {
        console.error(error);

        if (!shouldStop) {
          await wait(10_000);
        }
      }
    }
  } finally {
    await prisma.$disconnect();
  }
}

async function consumeStream(
  client: XApiClient,
  dependencies: StreamWorkerDependencies,
) {
  const response = await client.connectFilteredStream();

  if (!response.ok || !response.body) {
    const body = await response.text();
    throw new Error(`X stream failed: ${response.status} ${body.slice(0, 500)}`);
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (!shouldStop) {
    const { done, value } = await reader.read();

    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const lines = buffer.split(/\r?\n/);
    buffer = lines.pop() ?? "";

    for (const line of lines) {
      const trimmed = line.trim();

      if (!trimmed) {
        continue;
      }

      await handleStreamLine(trimmed, dependencies);
    }
  }
}

async function handleStreamLine(
  line: string,
  dependencies: StreamWorkerDependencies,
) {
  const payload = JSON.parse(line);
  const tweet = dependencies.parseStreamTweetPayload(payload);
  const result = await dependencies.saveStreamTweetAsRawPost(tweet);

  if (result.status === "duplicate") {
    return;
  }

  console.log(`Saved RawPost ${result.rawPostId}: ${tweet.originalUrl}`);
  await dependencies.processRawPostWithAi(result.rawPostId);
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}
