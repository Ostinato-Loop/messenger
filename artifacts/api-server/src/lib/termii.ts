export interface TermiiSmsResult {
  ok: boolean;
  error?: string;
}

export async function sendTermiiOtp(
  phone: string,
  code: string,
  appName = "Loop Messenger",
): Promise<TermiiSmsResult> {
  const apiKey = process.env.TERMII_API_KEY;

  if (!apiKey) {
    return { ok: false, error: "SMS service not configured" };
  }

  const senderId = process.env.TERMII_SENDER_ID ?? "Ostloop";
  const channel = process.env.TERMII_CHANNEL ?? "dnd";

  let response: globalThis.Response;
  try {
    response = await fetch("https://v3.api.termii.com/api/sms/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        to: phone,
        from: senderId,
        sms: `Your ${appName} verification code is: ${code}. Valid for 10 minutes. Do not share this code.`,
        type: "plain",
        channel,
        api_key: apiKey,
      }),
    });
  } catch {
    return { ok: false, error: "Network error contacting SMS service" };
  }

  let body: Record<string, unknown> = {};
  try {
    body = (await response.json()) as Record<string, unknown>;
  } catch {
    // non-JSON response — fall through
  }

  if (body.message_id || body.code === "ok") {
    return { ok: true };
  }

  const errMsg =
    typeof body.message === "string" ? body.message : `HTTP ${response.status}`;
  return { ok: false, error: errMsg };
}
