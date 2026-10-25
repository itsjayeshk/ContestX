import type { Sender } from "./types";

const RESEND_ENDPOINT = "https://api.resend.com/emails";

/** Email sender backed by Resend's REST API. */
export function resendSender(apiKey: string | undefined, from: string | undefined): Sender {
  return async ({ email, message, idempotencyKey }) => {
    if (!apiKey || !from) return { ok: false, transient: false, error: "Email is not configured on this server (RESEND_API_KEY / EMAIL_FROM)" };
    try {
      const res = await fetch(RESEND_ENDPOINT, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
          // Resend drops a repeated request with the same key, so a retried reminder can't send twice.
          "Idempotency-Key": idempotencyKey,
        },
        body: JSON.stringify({ from, to: [email], subject: message.subject, html: message.html, text: message.text }),
        signal: AbortSignal.timeout(15_000),
      });
      const data = (await res.json().catch(() => ({}))) as { id?: string; message?: string; name?: string };
      if (res.ok) return { ok: true, providerMessageId: data.id };
      const transient = res.status === 429 || res.status >= 500;
      return { ok: false, transient, error: `Resend ${res.status}: ${data.message ?? data.name ?? "request failed"}` };
    } catch (err) {
      return { ok: false, transient: true, error: `Resend request failed: ${err instanceof Error ? err.message : String(err)}` };
    }
  };
}
