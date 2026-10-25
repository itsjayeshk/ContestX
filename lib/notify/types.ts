export interface NotificationMessage {
  title: string;
  body: string;
  url: string;
  /** Plain-text and HTML variants for email. */
  text: string;
  html: string;
  subject: string;
}

export type SendResult =
  | { ok: true; providerMessageId?: string }
  | { ok: false; transient: boolean; error: string };

export interface SendContext {
  reminderId: string | null;
  userId: string;
  email: string;
  message: NotificationMessage;
  /** Stable key so a provider can drop a duplicate send of the same reminder. */
  idempotencyKey: string;
}

export type Sender = (ctx: SendContext) => Promise<SendResult>;
