import type {
  Channel,
  DeliveryStatus,
  LanguageCode,
  NotificationLog,
  Reminder,
  ReminderStatus
} from '../api';

export type AuthMode = 'login' | 'register';
export type ReminderStatusFilter = 'ALL' | ReminderStatus;
export type ReminderChannelFilter = 'ALL' | Channel;
export type NotificationStatusFilter = 'ALL' | DeliveryStatus;
export type NotificationChannelFilter = 'ALL' | Channel;
export type ThemeMode = 'light' | 'dark';
export type DashboardView = 'overview' | 'reminders' | 'history' | 'profile';
export type InspectorTarget = { kind: 'reminder'; item: Reminder } | { kind: 'notification'; item: NotificationLog };
export type CommandItem = {
  id: string;
  title: string;
  hint: string;
  group: string;
  shortcut?: string;
  run: () => void | Promise<void>;
};
export type EventStreamEntry = {
  id: string;
  time: string;
  command: string;
  detail: string;
  tone: string;
  target?: InspectorTarget;
};
export type PipelineStageState = 'done' | 'active' | 'queued' | 'error';
export type PasswordChangeForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
export type RegistrationProfileForm = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  preferredLanguage: LanguageCode;
};
export type ProfileForm = RegistrationProfileForm;
export type FormStatus = {
  tone: 'error' | 'success';
  message: string;
};

export type ReminderForm = {
  title: string;
  message: string;
  scheduledFor: string;
  channel: Channel;
  recipient: string;
};

export const LEGACY_TOKEN_KEY = 'notifyhub.dashboard.token';
export const AUTO_REFRESH_INTERVAL_MS = 5000;
export const THEME_KEY = 'notifyhub.dashboard.theme';
export const LANGUAGE_KEY = 'notifyhub.dashboard.language';
export const CHANNELS: Channel[] = ['EMAIL', 'SMS', 'PUSH'];
export const REMINDER_STATUSES: ReminderStatus[] = ['SCHEDULED', 'TRIGGERED', 'CANCELLED'];
export const DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'SENT', 'FAILED', 'RETRYING'];
export const DASHBOARD_ROUTES: Record<DashboardView, string> = {
  overview: '#overview',
  reminders: '#reminders',
  history: '#history',
  profile: '#profile'
};
