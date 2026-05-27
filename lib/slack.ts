export async function sendSlackMessage(text: string): Promise<"sent" | "skipped"> {
  return sendSlackWebhook(process.env.SLACK_WEBHOOK_URL, text);
}

export async function sendPublishSlackMessage(
  text: string,
): Promise<"sent" | "skipped"> {
  return sendSlackWebhook(
    process.env.SLACK_PUBLISH_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL,
    text,
  );
}

export async function sendReviewSlackMessage(
  text: string,
): Promise<"sent" | "skipped"> {
  return sendSlackWebhook(
    process.env.SLACK_REVIEW_WEBHOOK_URL ?? process.env.SLACK_WEBHOOK_URL,
    text,
  );
}

async function sendSlackWebhook(
  webhookUrl: string | undefined,
  text: string,
): Promise<"sent" | "skipped"> {
  if (!webhookUrl) {
    return "skipped";
  }

  const response = await fetch(webhookUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ text }),
  });

  if (!response.ok) {
    throw new Error(`Slack webhook failed: ${response.status}`);
  }

  return "sent";
}
