import type { ComponentType } from "react";
import { template as waitingListConfirm } from "./waiting-list-confirm";
import { template as securityScanAlert } from "./security-scan-alert";
import { template as proVettingStatus } from "./pro-vetting-status";
import { template as waitingListAreaLive } from "./waiting-list-area-live";
import { template as waitingListPositionChange } from "./waiting-list-position-change";
import { template as proApplicationStatus } from "./pro-application-status";
import { template as applicationReminder } from "./application-reminder";
import { template as leadConfirmation } from "./lead-confirmation";
import { template as leadReceived } from "./lead-received";
import { template as projectApplication } from "./project-application";
import { template as projectStatus } from "./project-status";
import { template as proClaimStatus } from "./pro-claim-status";
import { template as jobInterest } from "./job-interest";
import { template as portfolioStatus } from "./portfolio-status";
import { template as adminAlert } from "./admin-alert";
import { template as firmInvite } from "./firm-invite";
import { template as jobPosted } from "./job-posted";
import { template as quoteInvited } from "./quote-invited";
import { template as quoteReceived } from "./quote-received";
import { template as quoteDecision } from "./quote-decision";
import { template as complaintReceived } from "./complaint-received";
import { template as complaintToAnswer } from "./complaint-to-answer";
import { template as reviewPublished } from "./review-published";
import { template as visitRequested } from "./visit-requested";
import { template as visitDecision } from "./visit-decision";
import { template as credentialStatus } from "./credential-status";
import { template as credentialExpiring } from "./credential-expiring";
import { template as newMessage } from "./new-message";
import { template as jobNudge } from "./job-nudge";

export interface TemplateEntry {
  component: ComponentType<Record<string, unknown>>;
  subject: string | ((data: Record<string, unknown>) => string);
  displayName?: string;
  previewData?: Record<string, unknown>;
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string;
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  "waiting-list-confirm": waitingListConfirm,
  "security-scan-alert": securityScanAlert,
  "pro-vetting-status": proVettingStatus,
  "waiting-list-area-live": waitingListAreaLive,
  "waiting-list-position-change": waitingListPositionChange,
  "pro-application-status": proApplicationStatus,
  "application-reminder": applicationReminder,
  "lead-confirmation": leadConfirmation,
  "lead-received": leadReceived,
  "project-application": projectApplication,
  "project-status": projectStatus,
  "pro-claim-status": proClaimStatus,
  "job-interest": jobInterest,
  "portfolio-status": portfolioStatus,
  "admin-alert": adminAlert,
  "firm-invite": firmInvite,
  "job-posted": jobPosted,
  "quote-invited": quoteInvited,
  "quote-received": quoteReceived,
  "quote-decision": quoteDecision,
  "complaint-received": complaintReceived,
  "complaint-to-answer": complaintToAnswer,
  "review-published": reviewPublished,
  "visit-requested": visitRequested,
  "visit-decision": visitDecision,
  "credential-status": credentialStatus,
  "credential-expiring": credentialExpiring,
  "new-message": newMessage,
  "job-nudge": jobNudge,
};
