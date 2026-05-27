import {
  MANAGED_STREAM_RULE_TAG,
  XStreamRule,
  buildFilteredStreamRuleValue,
} from "@/lib/x-stream";

type XApiClientOptions = {
  bearerToken: string;
  baseUrl?: string;
};

type XRulesResponse = {
  data?: XStreamRule[];
};

export class XApiClient {
  private readonly bearerToken: string;
  private readonly baseUrl: string;

  constructor({ bearerToken, baseUrl = "https://api.x.com" }: XApiClientOptions) {
    this.bearerToken = bearerToken;
    this.baseUrl = baseUrl.replace(/\/+$/, "");
  }

  async getStreamRules(): Promise<XStreamRule[]> {
    const response = await this.requestJson<XRulesResponse>(
      "/2/tweets/search/stream/rules",
    );

    return response.data ?? [];
  }

  async syncWatchedAccountRule(accounts: { handle: string }[]): Promise<{
    ruleValue: string;
    unchanged: boolean;
  }> {
    const ruleValue = buildFilteredStreamRuleValue(accounts);
    const existingRules = await this.getStreamRules();
    const managedRules = existingRules.filter(
      (rule) => rule.tag === MANAGED_STREAM_RULE_TAG,
    );

    if (
      managedRules.length === 1 &&
      managedRules[0]?.value === ruleValue
    ) {
      return { ruleValue, unchanged: true };
    }

    if (managedRules.length > 0) {
      await this.requestJson("/2/tweets/search/stream/rules", {
        method: "POST",
        body: JSON.stringify({
          delete: {
            ids: managedRules.map((rule) => rule.id),
          },
        }),
      });
    }

    await this.requestJson("/2/tweets/search/stream/rules", {
      method: "POST",
      body: JSON.stringify({
        add: [
          {
            value: ruleValue,
            tag: MANAGED_STREAM_RULE_TAG,
          },
        ],
      }),
    });

    return { ruleValue, unchanged: false };
  }

  connectFilteredStream(signal?: AbortSignal): Promise<Response> {
    const params = new URLSearchParams({
      "tweet.fields": "author_id,created_at,lang",
      expansions: "author_id",
      "user.fields": "username,name",
    });

    return fetch(`${this.baseUrl}/2/tweets/search/stream?${params}`, {
      headers: this.headers(),
      signal,
    });
  }

  private async requestJson<T>(
    path: string,
    init: RequestInit = {},
  ): Promise<T> {
    const response = await fetch(`${this.baseUrl}${path}`, {
      ...init,
      headers: {
        ...this.headers(),
        "Content-Type": "application/json",
        ...init.headers,
      },
    });
    const text = await response.text();

    if (!response.ok) {
      throw new Error(
        `X API request failed: ${response.status} ${text.slice(0, 500)}`,
      );
    }

    return (text ? JSON.parse(text) : {}) as T;
  }

  private headers(): HeadersInit {
    return {
      Authorization: `Bearer ${this.bearerToken}`,
    };
  }
}

export function createXApiClientFromEnv(): XApiClient {
  const bearerToken = process.env.X_BEARER_TOKEN;

  if (!bearerToken) {
    throw new Error("X_BEARER_TOKEN is required.");
  }

  return new XApiClient({
    bearerToken,
    baseUrl: process.env.X_API_BASE_URL,
  });
}
