import { Bell, Mail, Smartphone } from 'lucide-react';
import type {
  Channel,
  DeliveryStatus,
  LanguageCode,
  NotificationFilters,
  NotificationLog,
  Reminder,
  ReminderFilters,
  ReminderStatus,
  UserSummary
} from '../api';
import {
  DashboardView,
  EventStreamEntry,
  LANGUAGE_KEY,
  NotificationStatusFilter,
  PasswordChangeForm,
  PipelineStageState,
  ProfileForm,
  RegistrationProfileForm,
  ReminderForm,
  ReminderStatusFilter,
  THEME_KEY,
  ThemeMode
} from './types';

export const emptyReminderForm = (user?: UserSummary | null): ReminderForm => ({
  title: '',
  message: '',
  scheduledFor: toDateTimeLocal(new Date(Date.now() + 15 * 60 * 1000).toISOString()),
  channel: 'EMAIL',
  recipient: defaultRecipientForChannel('EMAIL', user)
});

export const emptyPasswordChangeForm = (): PasswordChangeForm => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

export const emptyRegistrationProfileForm = (): RegistrationProfileForm => ({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  preferredLanguage: initialLanguage()
});

export const profileFormFromUser = (user: UserSummary): ProfileForm => ({
  firstName: user.firstName,
  lastName: user.lastName,
  phoneNumber: user.phoneNumber,
  preferredLanguage: user.preferredLanguage
});


export function channelIcon(channel: Channel) {
  if (channel === 'EMAIL') {
    return <Mail size={16} aria-hidden="true" />;
  }
  if (channel === 'SMS') {
    return <Smartphone size={16} aria-hidden="true" />;
  }
  return <Bell size={16} aria-hidden="true" />;
}

export function channelBadge(channel: Channel) {
  return <span className={`line-chip line-${channel.toLowerCase()}`}>{channelIcon(channel)}{channel}</span>;
}

export function statusBadge(status: string, t: (key: string) => string) {
  return <span className={`status-badge ${status.toLowerCase()}`}><i aria-hidden="true" />{statusLabel(status, t)}</span>;
}

export type LineHealth = 'good' | 'delays' | 'disruption' | 'idle';

// Transit-style service status for one channel: any failure is a disruption, any retry a delay.
export function lineHealth(notifications: NotificationLog[]): LineHealth {
  if (notifications.some((item) => item.status === 'FAILED')) {
    return 'disruption';
  }
  if (notifications.some((item) => item.status === 'RETRYING' || item.status === 'PENDING')) {
    return 'delays';
  }
  return notifications.length > 0 ? 'good' : 'idle';
}

export function statusFilterLabel(status: ReminderStatusFilter | NotificationStatusFilter, t: (key: string) => string) {
  return status === 'ALL' ? t('filters.all') : statusLabel(status, t);
}

export function statusLabel(status: string, t: (key: string) => string) {
  const key = `status.${status.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? status : translated;
}

export function reminderFormWithChannel(form: ReminderForm, channel: Channel, user: UserSummary | null): ReminderForm {
  const currentDefault = defaultRecipientForChannel(form.channel, user);
  const nextDefault = defaultRecipientForChannel(channel, user);
  const shouldUseDefaultRecipient = form.recipient.trim() === '' || form.recipient.trim() === currentDefault;

  return {
    ...form,
    channel,
    recipient: shouldUseDefaultRecipient ? nextDefault : form.recipient
  };
}

export function defaultRecipientForChannel(channel: Channel, user?: UserSummary | null) {
  if (!user) {
    return '';
  }
  if (channel === 'EMAIL') {
    return user.email;
  }
  if (channel === 'SMS') {
    return user.phoneNumber;
  }
  return '';
}

export function recipientPlaceholder(channel: Channel) {
  if (channel === 'EMAIL') {
    return 'user@example.com';
  }
  if (channel === 'SMS') {
    return '+905551112233';
  }
  return 'push-target-id';
}

export function hasReminderFilters(filters: ReminderFilters) {
  return Boolean(filters.status || filters.channel);
}

export function hasNotificationFilters(filters: NotificationFilters) {
  return Boolean(filters.status || filters.channel);
}

let displayLocale: string | undefined;

export function setDisplayLocale(locale: LanguageCode) {
  displayLocale = locale;
}

export function formatDate(value: string) {
  return new Intl.DateTimeFormat(displayLocale, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

export function formatClock(value: string) {
  return new Intl.DateTimeFormat(displayLocale, { hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(new Date(value));
}

export function formatDay(value: string) {
  return new Intl.DateTimeFormat(displayLocale, { weekday: 'short', day: 'numeric', month: 'short' }).format(new Date(value));
}

export function relativeTime(value: string, language: LanguageCode, now = Date.now()) {
  const minutes = Math.round((new Date(value).getTime() - now) / 60000);
  const format = new Intl.RelativeTimeFormat(language, { numeric: 'auto' });
  if (Math.abs(minutes) < 60) {
    return format.format(minutes, 'minute');
  }
  if (Math.abs(minutes) < 60 * 24) {
    return format.format(Math.round(minutes / 60), 'hour');
  }
  return format.format(Math.round(minutes / (60 * 24)), 'day');
}

export function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

export function initialTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  // Light is the default because the dashboard is mostly shown on projectors; dark stays one toggle away.
  return 'light';
}

export function initialLanguage(): LanguageCode {
  const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
  if (storedLanguage === 'en' || storedLanguage === 'tr') {
    return storedLanguage;
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('tr')) {
    return 'tr';
  }

  return 'en';
}

export function currentDashboardView(): DashboardView {
  if (typeof window === 'undefined') {
    return 'overview';
  }

  const normalizedHash = window.location.hash.toLowerCase();
  if (normalizedHash === '#overview' || normalizedHash === '#dashboard' || normalizedHash === '') {
    return 'overview';
  }
  if (normalizedHash === '#reminders') {
    return 'reminders';
  }
  if (normalizedHash === '#history' || normalizedHash === '#notifications') {
    return 'history';
  }
  if (normalizedHash === '#profile' || normalizedHash === '#settings') {
    return 'profile';
  }

  return 'overview';
}

export function fullName(user: UserSummary) {
  return [user.firstName, user.lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

export function profileInitial(user: UserSummary) {
  return (user.firstName || user.email).trim().charAt(0).toUpperCase() || 'U';
}

export function buildEventStream(reminders: Reminder[], notifications: NotificationLog[], t: (key: string) => string): EventStreamEntry[] {
  const reminderEvents: EventStreamEntry[] = reminders.map((reminder) => ({
    id: `reminder-${reminder.id}`,
    time: reminder.updatedAt,
    command: `reminder.${reminder.status.toLowerCase()}`,
    detail: `${reminder.title} → ${reminder.recipient}`,
    tone: reminder.status.toLowerCase(),
    target: { kind: 'reminder', item: reminder }
  }));
  const notificationEvents: EventStreamEntry[] = notifications.map((notification) => ({
    id: `notification-${notification.id}`,
    time: notification.updatedAt,
    command: `notification.${notification.status.toLowerCase()}`,
    detail: `${notification.subject} → ${notification.recipient}`,
    tone: notification.status.toLowerCase(),
    target: { kind: 'notification', item: notification }
  }));
  const combined = [...reminderEvents, ...notificationEvents].sort((left, right) => {
    return new Date(right.time).getTime() - new Date(left.time).getTime();
  });

  if (combined.length > 0) {
    return combined.slice(0, 7);
  }

  return [
    {
      id: 'boot-gateway',
      time: new Date().toISOString(),
      command: 'gateway.ready',
      detail: t('event.waitingPayloads'),
      tone: 'sent'
    },
    {
      id: 'boot-scheduler',
      time: new Date().toISOString(),
      command: 'scheduler.idle',
      detail: t('event.noRemindersQueued'),
      tone: 'scheduled'
    }
  ];
}

export function sortRemindersNewestFirst(reminders: Reminder[]) {
  return [...reminders].sort((left, right) => {
    return new Date(right.createdAt).getTime() - new Date(left.createdAt).getTime();
  });
}

export function pipelineStages(status?: ReminderStatus, deliveryStatus?: DeliveryStatus): { labelKey: string; state: PipelineStageState }[] {
  const labelKeys = ['pipeline.created', 'pipeline.scheduled', 'pipeline.queued', 'pipeline.delivery'];
  let activeIndex = 1;
  let failed = false;

  if (status === 'TRIGGERED') {
    activeIndex = 2;
  }
  if (status === 'CANCELLED') {
    activeIndex = 1;
    failed = true;
  }
  if (deliveryStatus === 'PENDING' || deliveryStatus === 'RETRYING') {
    activeIndex = 2;
  }
  if (deliveryStatus === 'SENT') {
    activeIndex = 3;
  }
  if (deliveryStatus === 'FAILED') {
    activeIndex = 3;
    failed = true;
  }

  return labelKeys.map((labelKey, index) => {
    if (failed && index === activeIndex) {
      return { labelKey: status === 'CANCELLED' ? 'pipeline.cancelled' : 'pipeline.failed', state: 'error' };
    }
    if (index < activeIndex) {
      return { labelKey, state: 'done' };
    }
    if (index === activeIndex) {
      return { labelKey, state: 'active' };
    }
    return { labelKey, state: 'queued' };
  });
}

export function formatError(error: unknown, translate: (key: string) => string) {
  if (error instanceof Error) {
    return translate(error.message) === error.message && error.message.startsWith('error.')
      ? error.message
      : translate(error.message);
  }
  return translate('error.unexpected');
}
