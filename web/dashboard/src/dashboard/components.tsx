import { FormEvent, RefObject, useEffect, useRef, useState } from 'react';
import { KeyRound, Loader2, Moon, Plus, Save, Search, Sun, X } from 'lucide-react';
import type { Channel, DeliveryStatus, LanguageCode, NotificationLog, Reminder, ReminderStatus, UserSummary } from '../api';
import {
  CHANNELS,
  CommandItem,
  EventStreamEntry,
  FormStatus,
  InspectorTarget,
  PasswordChangeForm,
  ProfileForm,
  ThemeMode
} from './types';
import {
  channelBadge,
  formatClock,
  formatDate,
  formatDay,
  fullName,
  lineHealth,
  pipelineStages,
  profileInitial,
  relativeTime,
  statusBadge,
  statusLabel
} from './utils';

type Translate = (key: string) => string;

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Modal dialogs: move focus in, keep Tab inside, and give focus back to the opener on close (WCAG 2.4.3).
function useDialogFocus(ref: RefObject<HTMLElement | null>) {
  useEffect(() => {
    const opener = document.activeElement as HTMLElement | null;
    const dialog = ref.current;
    if (!dialog) {
      return;
    }
    if (!dialog.contains(document.activeElement)) {
      (dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog).focus();
    }

    function trapTab(event: KeyboardEvent) {
      if (event.key !== 'Tab' || !dialog) {
        return;
      }
      const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)];
      if (items.length === 0) {
        event.preventDefault();
        return;
      }
      const first = items[0];
      const last = items[items.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }

    dialog.addEventListener('keydown', trapTab);
    return () => {
      dialog.removeEventListener('keydown', trapTab);
      opener?.focus?.();
    };
  }, [ref]);
}

// Re-render on a timer so clocks and countdowns stay current between data refreshes.
function useNow(intervalMs: number) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = window.setInterval(() => setNow(Date.now()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
type Metrics = { scheduled: number; triggered: number; sent: number; failed: number; retrying: number; totalAttempts: number };

export function DeparturesBoard({
  reminders,
  language,
  onInspect,
  onCreate,
  t
}: {
  reminders: Reminder[];
  language: LanguageCode;
  onInspect: (target: InspectorTarget) => void;
  onCreate: () => void;
  t: Translate;
}) {
  const now = useNow(15000);
  const departures = reminders
    .filter((reminder) => reminder.status === 'SCHEDULED')
    .sort((left, right) => new Date(left.scheduledFor).getTime() - new Date(right.scheduledFor).getTime())
    .slice(0, 5);

  return (
    <section className="board" aria-labelledby="departures-title">
      <header className="board-head">
        <h2 id="departures-title">{t('overview.departures.title')}</h2>
        <span className="board-clock">{formatClock(new Date(now).toISOString())}</span>
      </header>
      {departures.length === 0 ? (
        <div className="board-empty">
          <p>{t('overview.departures.empty')}</p>
          <button type="button" className="button primary" onClick={onCreate}>
            <Plus size={16} aria-hidden="true" />{t('command.createReminder.title')}
          </button>
        </div>
      ) : (
        <ol className="board-rows">
          {departures.map((reminder) => {
            const due = new Date(reminder.scheduledFor).getTime() <= now;
            return (
              <li key={reminder.id}>
                <button type="button" className="board-row" onClick={() => onInspect({ kind: 'reminder', item: reminder })}>
                  <span className="board-time">
                    <strong>{formatClock(reminder.scheduledFor)}</strong>
                    <small>{formatDay(reminder.scheduledFor)}</small>
                  </span>
                  <span className="board-title">
                    <strong>{reminder.title}</strong>
                    <small>{reminder.recipient}</small>
                  </span>
                  {channelBadge(reminder.channel)}
                  <span className={`board-eta ${due ? 'due' : ''}`}>
                    {due ? t('overview.departures.due') : relativeTime(reminder.scheduledFor, language, now)}
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      )}
    </section>
  );
}

export function LineStatus({
  notifications,
  metrics,
  t
}: {
  notifications: NotificationLog[];
  metrics: Metrics;
  t: Translate;
}) {
  return (
    <section className="panel line-status" aria-labelledby="line-status-title">
      <header className="panel-head">
        <h2 id="line-status-title">{t('overview.status.title')}</h2>
      </header>
      <ul className="line-list" aria-label={t('aria.deliveryMetrics')}>
        {CHANNELS.map((channel) => {
          const onLine = notifications.filter((item) => item.channel === channel);
          const health = lineHealth(onLine);
          const counts = (['SENT', 'RETRYING', 'FAILED'] as DeliveryStatus[])
            .map((status) => [status, onLine.filter((item) => item.status === status).length] as const)
            .filter(([, count]) => count > 0);
          return (
            <li key={channel} className={`line-row ${health}`}>
              {channelBadge(channel)}
              <span className="line-health">{t(`overview.status.${health}`)}</span>
              <span className="line-counts">
                {counts.length === 0 ? '—' : counts.map(([status, count]) => `${count} ${statusLabel(status, t).toLowerCase()}`).join(' · ')}
              </span>
            </li>
          );
        })}
      </ul>
      <dl className="totals">
        <div><dt>{t('metrics.scheduled')}</dt><dd>{metrics.scheduled}</dd></div>
        <div><dt>{t('metrics.triggered')}</dt><dd>{metrics.triggered}</dd></div>
        <div><dt>{t('metrics.sent')}</dt><dd>{metrics.sent}</dd></div>
        <div className={metrics.failed > 0 ? 'alarm' : ''}><dt>{t('metrics.failed')}</dt><dd>{metrics.failed}</dd></div>
        <div><dt>{t('metrics.retrying')}</dt><dd>{metrics.retrying}</dd></div>
        <div><dt>{t('metrics.attempts')}</dt><dd>{metrics.totalAttempts}</dd></div>
      </dl>
    </section>
  );
}

export function ServiceTopology({ metrics, t }: { metrics: Metrics; t: Translate }) {
  const mainLine = [
    { key: 'gateway', name: 'Gateway', detail: t('topology.gateway.detail'), meta: `${metrics.totalAttempts} ${t('topology.gateway.meta')}` },
    { key: 'reminder', name: 'Reminder', detail: t('topology.reminder.detail'), meta: `${metrics.scheduled} ${t('topology.reminder.meta')}` },
    { key: 'kafka', name: 'Kafka', detail: t('topology.kafka.detail'), meta: `${metrics.triggered} ${t('topology.kafka.meta')}` },
    { key: 'notification', name: 'Notification', detail: t('topology.notification.detail'), meta: `${metrics.sent} ${t('topology.notification.meta')}` },
    { key: 'rabbitmq', name: 'RabbitMQ', detail: t('topology.rabbitmq.detail'), meta: `${metrics.retrying} ${t('topology.rabbitmq.meta')}`, alert: metrics.failed > 0 || metrics.retrying > 0 }
  ];
  const branches = [
    { key: 'auth', name: 'Auth', detail: t('topology.auth.detail'), meta: t('topology.auth.meta') },
    { key: 'storage', name: 'PostgreSQL', detail: t('topology.storage.detail'), meta: `${metrics.failed + metrics.retrying} ${t('topology.storage.meta')}` }
  ];

  return (
    <section className="panel topology" aria-labelledby="topology-title">
      <header className="panel-head">
        <h2 id="topology-title">{t('overview.topology.title')}</h2>
        <span className="live-chip"><span className="live-dot" aria-hidden="true" />{t('runtime.live')}</span>
      </header>
      <div className="line-map">
        <ol className="line-map-main" aria-label={t('aria.serviceDependencies')}>
          {mainLine.map((stop) => (
            <li key={stop.key} className={`map-stop ${stop.alert ? 'alert' : ''}`}>
              <span className="map-dot" aria-hidden="true" />
              <strong>{stop.name}</strong>
              <span>{stop.detail}</span>
              <small>{stop.meta}</small>
            </li>
          ))}
        </ol>
        <ol className="line-map-branch">
          {branches.map((stop) => (
            <li key={stop.key} className="map-stop branch">
              <span className="map-dot" aria-hidden="true" />
              <strong>{stop.name}</strong>
              <span>{stop.detail}</span>
              <small>{stop.meta}</small>
            </li>
          ))}
        </ol>
      </div>
    </section>
  );
}

export function LiveEventConsole({
  events,
  onInspect,
  t
}: {
  events: EventStreamEntry[];
  onInspect: (target: InspectorTarget) => void;
  t: Translate;
}) {
  return (
    <section className="panel activity" aria-labelledby="console-title">
      <header className="panel-head">
        <h2 id="console-title">{t('overview.console.title')}</h2>
      </header>
      <div className="activity-log" role="log" aria-label={t('aria.liveEventStream')} tabIndex={0}>
        {events.map((event) => (
          <button
            type="button"
            className={`activity-row ${event.tone}`}
            key={event.id}
            onClick={() => event.target ? onInspect(event.target) : undefined}
            disabled={!event.target}
          >
            <time>{formatClock(event.time)}</time>
            <span className="activity-dot" aria-hidden="true" />
            <span className="activity-copy">
              <strong>{event.detail}</strong>
              <code>{event.command}</code>
            </span>
          </button>
        ))}
      </div>
    </section>
  );
}

export function CommandPalette({
  query,
  commands,
  onQueryChange,
  onRun,
  onClose,
  t
}: {
  query: string;
  commands: CommandItem[];
  onQueryChange: (query: string) => void;
  onRun: (command: CommandItem) => void;
  onClose: () => void;
  t: Translate;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef);
  const [activeIndex, setActiveIndex] = useState(0);
  const active = Math.min(activeIndex, Math.max(commands.length - 1, 0));
  const optionId = (index: number) => `command-option-${index}`;

  useEffect(() => {
    document.getElementById(optionId(active))?.scrollIntoView?.({ block: 'nearest' });
  }, [active]);

  return (
    <div
      className="overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section ref={dialogRef} className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
        <h2 id="command-title" className="visually-hidden">{t('command.title')}</h2>
        <div className="command-input">
          <Search size={18} aria-hidden="true" />
          <input
            autoFocus
            role="combobox"
            aria-expanded="true"
            aria-controls="command-options"
            aria-autocomplete="list"
            aria-activedescendant={commands[active] ? optionId(active) : undefined}
            value={query}
            onChange={(event) => {
              setActiveIndex(0);
              onQueryChange(event.target.value);
            }}
            onKeyDown={(event) => {
              if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
                event.preventDefault();
                if (commands.length > 0) {
                  const step = event.key === 'ArrowDown' ? 1 : -1;
                  setActiveIndex((active + step + commands.length) % commands.length);
                }
              }
              if (event.key === 'Enter' && commands[active]) {
                event.preventDefault();
                onRun(commands[active]);
              }
            }}
            aria-label={t('command.title')}
            placeholder={t('command.placeholder')}
          />
          <kbd>Esc</kbd>
        </div>
        <div className="command-list" id="command-options" role="listbox" aria-label={t('command.title')}>
          {commands.map((command, index) => (
            <button
              type="button"
              role="option"
              id={optionId(index)}
              aria-selected={index === active}
              tabIndex={-1}
              className="command-item"
              key={command.id}
              onMouseMove={() => setActiveIndex(index)}
              onClick={() => onRun(command)}
            >
              <span>
                <strong>{command.title}</strong>
                <small>{command.group} · {command.hint}</small>
              </span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
            </button>
          ))}
          {commands.length === 0 ? <p className="empty-state">{t('command.noMatch')}</p> : null}
        </div>
      </section>
    </div>
  );
}

export function InspectorDrawer({
  target,
  onClose,
  t
}: {
  target: InspectorTarget;
  onClose: () => void;
  t: Translate;
}) {
  const dialogRef = useRef<HTMLElement>(null);
  useDialogFocus(dialogRef);
  const title = target.kind === 'reminder' ? target.item.title : target.item.subject;
  const payload = JSON.stringify(target.item, null, 2);

  return (
    <div
      className="overlay drawer-overlay"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <aside ref={dialogRef} className="inspector" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
        <header className="inspector-head">
          <div>
            {channelBadge(target.item.channel)}
            <h2 id="inspector-title">{title}</h2>
            <p>{target.item.recipient}</p>
          </div>
          <button type="button" className="icon-button" onClick={onClose} aria-label={t('actions.closeInspector')}>
            <X size={18} aria-hidden="true" />
          </button>
        </header>
        <PipelineTimeline
          status={target.kind === 'reminder' ? target.item.status : undefined}
          deliveryStatus={target.kind === 'notification' ? target.item.status : undefined}
          channel={target.item.channel}
          variant="drawer"
          ariaLabel={t('aria.deliveryPipeline')}
          t={t}
        />
        <h3>{t('inspector.payload')}</h3>
        <pre>{payload}</pre>
      </aside>
    </div>
  );
}

export function ProfileSettingsPage({
  user,
  profileForm,
  profileStatus,
  profileSubmitting,
  onProfileChange,
  onLanguageChange,
  onProfileSubmit,
  passwordForm,
  passwordStatus,
  passwordSubmitting,
  onPasswordChange,
  onPasswordSubmit,
  t
}: {
  user: UserSummary;
  profileForm: ProfileForm;
  profileStatus: FormStatus | null;
  profileSubmitting: boolean;
  onProfileChange: (form: ProfileForm) => void;
  onLanguageChange: (language: LanguageCode) => void;
  onProfileSubmit: (event: FormEvent<HTMLFormElement>) => void;
  passwordForm: PasswordChangeForm;
  passwordStatus: FormStatus | null;
  passwordSubmitting: boolean;
  onPasswordChange: (form: PasswordChangeForm) => void;
  onPasswordSubmit: (event: FormEvent<HTMLFormElement>) => void;
  t: Translate;
}) {
  const displayName = fullName(user);
  // Server errors are form-level, so every field points at the one message that explains them.
  const fieldError = profileStatus?.tone === 'error' ? { 'aria-invalid': true, 'aria-describedby': 'profile-status' } : {};

  return (
    <section className="profile-grid" id="profile" aria-label={t('aria.profileSettings')}>
      <section className="panel" aria-labelledby="profile-title">
        <header className="panel-head">
          <h2 id="profile-title">{t('profile.details')}</h2>
          {statusBadge(user.role, t)}
        </header>

        <div className="identity">
          <div className="avatar" aria-hidden="true">{profileInitial(user)}</div>
          <div>
            <strong>{displayName || user.email}</strong>
            <span>{user.email}</span>
          </div>
        </div>

        <form className="form" onSubmit={onProfileSubmit}>
          <div className="form-row">
            <label>
              {t('auth.firstName')}
              <input
                type="text"
                value={profileForm.firstName}
                onChange={(event) => onProfileChange({ ...profileForm, firstName: event.target.value })}
                autoComplete="given-name"
                {...fieldError}
                maxLength={80}
                required
              />
            </label>
            <label>
              {t('auth.lastName')}
              <input
                type="text"
                value={profileForm.lastName}
                onChange={(event) => onProfileChange({ ...profileForm, lastName: event.target.value })}
                autoComplete="family-name"
                {...fieldError}
                maxLength={80}
                required
              />
            </label>
          </div>
          <div className="form-row">
            <label>
              {t('auth.phoneNumber')}
              <input
                type="tel"
                value={profileForm.phoneNumber}
                onChange={(event) => onProfileChange({ ...profileForm, phoneNumber: event.target.value })}
                autoComplete="tel"
                {...fieldError}
                maxLength={32}
                required
              />
            </label>
            <label>
              {t('profile.language')}
              <select
                value={profileForm.preferredLanguage}
                onChange={(event) => onLanguageChange(event.target.value as LanguageCode)}
              >
                <option value="en">{t('profile.languageEnglish')}</option>
                <option value="tr">{t('profile.languageTurkish')}</option>
              </select>
            </label>
          </div>
          {profileStatus ? <p id="profile-status" className={`form-message ${profileStatus.tone}`} role={profileStatus.tone === 'error' ? 'alert' : 'status'}>{profileStatus.message}</p> : null}
          <div className="form-actions">
            <button type="submit" className="button primary" disabled={profileSubmitting}>
              {profileSubmitting ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <Save size={16} aria-hidden="true" />}
              {t('actions.saveProfile')}
            </button>
          </div>
        </form>

        <dl className="facts">
          <div>
            <dt>{t('profile.userId')}</dt>
            <dd><code>{user.id}</code></dd>
          </div>
          <div>
            <dt>{t('profile.role')}</dt>
            <dd>{user.role}</dd>
          </div>
          <div>
            <dt>{t('profile.created')}</dt>
            <dd>{user.createdAt ? formatDate(user.createdAt) : t('profile.activeSession')}</dd>
          </div>
        </dl>
      </section>

      <section className="panel" aria-labelledby="security-title">
        <header className="panel-head">
          <h2 id="security-title">{t('profile.password')}</h2>
          <KeyRound size={18} aria-hidden="true" />
        </header>
        <PasswordChangeFormView
          form={passwordForm}
          status={passwordStatus}
          submitting={passwordSubmitting}
          onChange={onPasswordChange}
          onSubmit={onPasswordSubmit}
          t={t}
        />
      </section>
    </section>
  );
}

export function PasswordChangeFormView({
  form,
  status,
  submitting,
  onChange,
  onSubmit,
  t
}: {
  form: PasswordChangeForm;
  status: FormStatus | null;
  submitting: boolean;
  onChange: (form: PasswordChangeForm) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
  t: Translate;
}) {
  const fieldError = status?.tone === 'error' ? { 'aria-invalid': true, 'aria-describedby': 'password-status' } : {};

  return (
    <form className="form" onSubmit={onSubmit}>
      <label>
        {t('password.current')}
        <input
          id="current-password-input"
          type="password"
          value={form.currentPassword}
          onChange={(event) => onChange({ ...form, currentPassword: event.target.value })}
          autoComplete="current-password"
          {...fieldError}
          minLength={8}
          maxLength={128}
          required
        />
      </label>
      <label>
        {t('password.new')}
        <input
          type="password"
          value={form.newPassword}
          onChange={(event) => onChange({ ...form, newPassword: event.target.value })}
          autoComplete="new-password"
          {...fieldError}
          minLength={8}
          maxLength={128}
          required
        />
      </label>
      <label>
        {t('password.confirm')}
        <input
          type="password"
          value={form.confirmPassword}
          onChange={(event) => onChange({ ...form, confirmPassword: event.target.value })}
          autoComplete="new-password"
          {...fieldError}
          minLength={8}
          maxLength={128}
          required
        />
      </label>
      {status ? <p id="password-status" className={`form-message ${status.tone}`} role={status.tone === 'error' ? 'alert' : 'status'}>{status.message}</p> : null}
      <div className="form-actions">
        <button type="submit" className="button primary" disabled={submitting}>
          {submitting ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <KeyRound size={16} aria-hidden="true" />}
          {t('actions.changePassword')}
        </button>
      </div>
    </form>
  );
}

export function PipelineTimeline({
  status,
  deliveryStatus,
  channel,
  variant,
  ariaLabel,
  t
}: {
  status?: ReminderStatus;
  deliveryStatus?: DeliveryStatus;
  channel?: Channel;
  variant?: 'drawer';
  ariaLabel?: string;
  t?: Translate;
}) {
  const stages = pipelineStages(status, deliveryStatus);
  const label = (key: string) => t ? t(key) : key;
  const current = stages.find((stage) => stage.state === 'active' || stage.state === 'error') ?? stages[stages.length - 1];

  return (
    <div className={`route ${variant ?? 'compact'} ${channel ? `line-${channel.toLowerCase()}` : ''}`}>
      <ol aria-label={ariaLabel ?? 'Delivery pipeline'}>
        {stages.map((stage) => (
          <li className={stage.state} key={stage.labelKey}>
            <span className="route-stop" aria-hidden="true" />
            <span className={variant === 'drawer' ? 'route-label' : 'visually-hidden'}>{label(stage.labelKey)}</span>
          </li>
        ))}
      </ol>
      {variant === 'drawer' ? null : <span className={`route-current ${current.state}`} aria-hidden="true">{label(current.labelKey)}</span>}
    </div>
  );
}

export function ThemeToggle({ theme, onToggle, t }: { theme: ThemeMode; onToggle: () => void; t: Translate }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const title = nextTheme === 'dark' ? t('theme.switchDark') : t('theme.switchLight');

  return (
    <button
      type="button"
      className="rail-action theme-toggle"
      onClick={onToggle}
      title={title}
      aria-label={title}
    >
      {theme === 'dark' ? <Sun size={17} aria-hidden="true" /> : <Moon size={17} aria-hidden="true" />}
      <span>{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span>
    </button>
  );
}
