import * as React from 'react'
import { render } from '@react-email/render'
import { deliverEmail } from './email-transport'
import { TEMPLATES } from './registry'

// Server-only: delivery via email-transport (Resend or Lovable). Never import from client components.

// Configuration baked in at scaffold time
const SITE_NAME = "TradesmanFinder"
// SENDER_DOMAIN is the verified sender subdomain FQDN (e.g., "notify.example.com").
// It MUST match the subdomain delegated to Lovable's nameservers. NEVER use the root domain.
const SENDER_DOMAIN = "notify.tradesmanfinder.org"
// FROM_DOMAIN is the domain shown in the From: header (e.g., "example.com").
// Can be the root domain when display_from_root is enabled — this is cosmetic only.
const FROM_DOMAIN = "notify.tradesmanfinder.org"

type Env = Record<string, string | undefined>
const envOf = (): Env => (globalThis as { process?: { env?: Env } }).process?.env ?? {}

export type EmailSender = { from: string; senderDomain: string }

/**
 * Resolves the From header and sender domain.
 *
 * EMAIL_FROM_DOMAIN is optional. When it is set (production on Cloudflare uses
 * Resend with EMAIL_FROM_DOMAIN=tradesmanfinder.org), the From header becomes
 * `TradesmanFinder <noreply@${EMAIL_FROM_DOMAIN}>` and the sender domain
 * follows it. When it is unset, the baked-in notify.tradesmanfinder.org values
 * are returned unchanged, so preview via Lovable Emails behaves exactly as
 * before.
 */
export function resolveSender(e: Env = envOf()): EmailSender {
  const domain = (e['EMAIL_FROM_DOMAIN'] ?? '').trim()
  if (!domain) {
    return { from: `${SITE_NAME} <noreply@${FROM_DOMAIN}>`, senderDomain: SENDER_DOMAIN }
  }
  return { from: `${SITE_NAME} <noreply@${domain}>`, senderDomain: domain }
}

export type SendTemplateEmailResult =
  | { sent: true }
  | { sent: false; reason: 'recipient_suppressed' }

export interface SendTemplateEmailOptions {
  templateData?: Record<string, any>
  /** Dedupes retries of the same logical send; defaults to a random UUID (no dedupe). */
  idempotencyKey?: string
  replyTo?: string
}

/**
 * Renders a registered template and sends it through Lovable's managed email
 * API. Suppression, retries, and rate limits are enforced by Lovable
 * server-side. A suppressed recipient is an expected outcome
 * ({ sent: false }); any other failure throws — EmailAPIError exposes
 * .code and .status for branching.
 */
export async function sendTemplateEmail(
  templateName: string,
  to: string,
  options: SendTemplateEmailOptions = {}
): Promise<SendTemplateEmailResult> {

  const template = TEMPLATES[templateName]
  if (!template) {
    throw new Error(
      `Template '${templateName}' not found. Available: ${Object.keys(TEMPLATES).join(', ')}`
    )
  }

  // Template-level `to` takes precedence — notification templates always
  // send to their fixed address.
  const recipient = template.to || to
  if (!recipient) {
    throw new Error('Recipient is required (the template defines no fixed recipient)')
  }

  const templateData = options.templateData ?? {}
  const element = React.createElement(template.component, templateData)
  const html = await render(element)
  const text = await render(element, { plainText: true })
  const subject =
    typeof template.subject === 'function'
      ? template.subject(templateData)
      : template.subject

  const sender = resolveSender()
  return deliverEmail({
    to: recipient,
    from: sender.from,
    senderDomain: sender.senderDomain,
    subject,
    html,
    text,
    purpose: 'transactional',
    template: templateName,
    idempotencyKey: options.idempotencyKey || crypto.randomUUID(),
    ...(options.replyTo ? { replyTo: options.replyTo } : {}),
  })
}
