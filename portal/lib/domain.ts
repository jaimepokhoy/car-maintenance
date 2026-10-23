/**
 * The app's pure domain code, imported from the repo's `src/domain/` rather
 * than copied, so the portal and the app agree on what is due. Next.js
 * compiles these files as part of the portal (see `next.config.ts`). Import
 * the modules one by one: `src/domain/index.ts` pulls in everything.
 */
export {
  DUE_SOON_DAYS,
  DUE_SOON_KM,
  computeVehicleDueStatuses,
  type DueState,
  type DueStatus,
} from '../../src/domain/due-status';
export { addDays, daysBetween } from '../../src/domain/dates';
export { defaultSchedule, resolveSchedule } from '../../src/domain/schedules';
export { parseMoneyToCents, validateServiceForm, type ServiceFormError } from '../../src/domain/service-form';
export type {
  IsoDate,
  MaintenanceInterval,
  MaintenanceItemId,
  Powertrain,
  ServiceRecord,
  Vehicle,
} from '../../src/domain/types';
export { formatDate, formatDistance, formatMoney } from '../../src/domain/units';
export {
  CAMPAIGN_BODY_MAX,
  CAMPAIGN_LIMIT,
  CAMPAIGN_TITLE_MAX,
  CAMPAIGN_WINDOW_DAYS,
  type CampaignAllowance,
  type CampaignAudience,
  type CampaignDraft,
  type CampaignError,
  type CampaignField,
  campaignAllowance,
  isUnfinishedSend,
  validateCampaign,
} from '../../src/domain/campaigns';
