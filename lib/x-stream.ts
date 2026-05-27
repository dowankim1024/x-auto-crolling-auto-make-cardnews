export const MANAGED_STREAM_RULE_TAG = "x-cardnews-admin:watched-accounts";

export type XStreamRule = {
  id: string;
  value: string;
  tag?: string;
};

export type WatchedAccountForRule = {
  handle: string;
};

export type StreamTweetPayload = {
  data?: {
    id?: string;
    text?: string;
    created_at?: string;
    lang?: string;
    author_id?: string;
  };
  includes?: {
    users?: {
      id?: string;
      username?: string;
      name?: string;
    }[];
  };
  matching_rules?: {
    id?: string;
    tag?: string;
  }[];
};

export type ParsedStreamTweet = {
  externalPostId: string;
  originalText: string;
  originalUrl: string;
  postedAt: Date;
  language?: string;
  sourceHandle?: string;
  rawJson: StreamTweetPayload;
};

export function buildFilteredStreamRuleValue(
  accounts: WatchedAccountForRule[],
): string {
  const handles = accounts
    .map((account) => normalizeXHandle(account.handle))
    .filter((handle) => handle.length > 0);

  if (handles.length === 0) {
    throw new Error("At least one watched X account is required.");
  }

  const authorClause = handles.map((handle) => `from:${handle}`).join(" OR ");
  return `(${authorClause}) -is:retweet -is:reply`;
}

export function parseStreamTweetPayload(
  payload: StreamTweetPayload,
): ParsedStreamTweet {
  const tweet = payload.data;

  if (!tweet?.id || !tweet.text) {
    throw new Error("Stream payload is missing tweet id or text.");
  }

  const user = payload.includes?.users?.find(
    (candidate) => candidate.id === tweet.author_id,
  );
  const sourceHandle = user?.username;
  const postedAt = tweet.created_at ? new Date(tweet.created_at) : new Date();

  if (Number.isNaN(postedAt.getTime())) {
    throw new Error("Stream payload has an invalid created_at value.");
  }

  return {
    externalPostId: tweet.id,
    originalText: tweet.text,
    originalUrl: buildTweetUrl(sourceHandle ?? "i", tweet.id),
    postedAt,
    language: tweet.lang,
    sourceHandle,
    rawJson: payload,
  };
}

export function buildTweetUrl(handle: string, tweetId: string): string {
  return `https://x.com/${normalizeXHandle(handle)}/status/${tweetId}`;
}

export function normalizeXHandle(handle: string): string {
  return handle.trim().replace(/^@+/, "");
}
