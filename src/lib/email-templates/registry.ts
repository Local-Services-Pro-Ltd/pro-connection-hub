import type { ComponentType } from 'react'
import { template as waitingListConfirm } from './waiting-list-confirm'
import { template as securityScanAlert } from './security-scan-alert'
import { template as proVettingStatus } from './pro-vetting-status'
import { template as waitingListAreaLive } from './waiting-list-area-live'
import { template as waitingListPositionChange } from './waiting-list-position-change'
import { template as proApplicationStatus } from './pro-application-status'
import { template as applicationReminder } from './application-reminder'
import { template as leadConfirmation } from './lead-confirmation'
import { template as leadReceived } from './lead-received'
import { template as projectApplication } from './project-application'
import { template as projectStatus } from './project-status'


export interface TemplateEntry {
  component: ComponentType<any>
  subject: string | ((data: Record<string, any>) => string)
  displayName?: string
  previewData?: Record<string, any>
  /** Fixed recipient — overrides caller-provided recipientEmail when set. */
  to?: string
}

/**
 * Template registry — maps template names to their React Email components.
 * Import and register new templates here after creating them in this directory.
 */
export const TEMPLATES: Record<string, TemplateEntry> = {
  'waiting-list-confirm': waitingListConfirm,
  'security-scan-alert': securityScanAlert,
  'pro-vetting-status': proVettingStatus,
  'waiting-list-area-live': waitingListAreaLive,
  'waiting-list-position-change': waitingListPositionChange,
  'pro-application-status': proApplicationStatus,
  'application-reminder': applicationReminder,
}
