import { FormEvent } from 'react';
import { KeyRound, Loader2, Moon, Save, Sun, Terminal, XCircle } from 'lucide-react';
import type { DeliveryStatus, LanguageCode, ReminderStatus, UserSummary } from '../api';
import {
  CommandItem,
  EventStreamEntry,
  FormStatus,
  InspectorTarget,
  PasswordChangeForm,
  ProfileForm,
  ThemeMode
} from './types';
import {
  formatConsoleTime,
  formatDate,
  fullName,
  pipelineStages,
  profileInitial,
  statusBadge
} from './utils';

export function ServiceTopology({
  metrics,
  t
}: {
  metrics: { scheduled: number; triggered: number; sent: number; failed: number; retrying: number; totalAttempts: number };
  t: (key: string) => string;
}) {
  const services = [
    { key: 'gateway', name: 'Gateway', detail: t('topology.gateway.detail'), meta: `${metrics.totalAttempts} ${t('topology.gateway.meta')}` },
    { key: 'auth', name: 'Auth', detail: t('topology.auth.detail'), meta: t('topology.auth.meta') },
    { key: 'reminder', name: 'Reminder', detail: t('topology.reminder.detail'), meta: `${metrics.scheduled} ${t('topology.reminder.meta')}` },
    { key: 'kafka', name: 'Kafka', detail: t('topology.kafka.detail'), meta: `${metrics.triggered} ${t('topology.kafka.meta')}` },
    { key: 'notification', name: 'Notify', detail: t('topology.notification.detail'), meta: `${metrics.sent} ${t('topology.notification.meta')}` },
    { key: 'storage', name: 'Postgres', detail: t('topology.storage.detail'), meta: `${metrics.failed + metrics.retrying} ${t('topology.storage.meta')}` }
  ];

  return (
    <section className="cockpit-card topology-card" aria-labelledby="topology-title">
      <div className="cockpit-heading">
        <div>
          <p className="eyebrow">{t('overview.topology.eyebrow')}</p>
          <h2 id="topology-title">{t('overview.topology.title')}</h2>
        </div>
        <span className="live-chip"><span className="pulse-dot" />{t('runtime.live')}</span>
      </div>

      <div className="topology-map">
        <svg className="topology-lines" viewBox="0 0 640 300" role="img" aria-label={t('aria.serviceDependencies')}>
          <path d="M92 82 C190 42 262 42 322 82" />
          <path d="M322 82 C418 38 496 44 548 82" />
          <path d="M322 82 C312 132 312 166 322 214" />
          <path d="M92 218 C188 260 254 258 322 214" />
          <path d="M322 214 C418 260 490 256 548 218" />
          <path d="M548 82 C590 130 590 172 548 218" />
        </svg>
        {services.map((service) => (
          <div className={`topology-node ${service.key}`} key={service.key}>
            <span className="node-orbit" />
            <strong>{service.name}</strong>
            <code>{service.detail}</code>
            <small>{service.meta}</small>
          </div>
        ))}
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
  t: (key: string) => string;
}) {
  return (
    <section className="cockpit-card console-card" aria-labelledby="console-title">
      <div className="cockpit-heading">
        <div>
          <p className="eyebrow">{t('overview.console.eyebrow')}</p>
          <h2 id="console-title">{t('overview.console.title')}</h2>
        </div>
      </div>

      <div className="console-window" role="log" aria-live="polite" aria-label={t('aria.liveEventStream')} tabIndex={0}>
        {events.map((event) => (
          <button
            type="button"
            className={`console-line ${event.tone}`}
            key={event.id}
            onClick={() => event.target ? onInspect(event.target) : undefined}
            disabled={!event.target}
          >
            <code>{formatConsoleTime(event.time)}</code>
            <strong>{event.command}</strong>
            <span>{event.detail}</span>
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
  t: (key: string) => string;
}) {
  return (
    <div
      className="command-backdrop"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="command-palette" role="dialog" aria-modal="true" aria-labelledby="command-title">
        <div className="command-input">
          <Terminal size={18} aria-hidden="true" />
          <input
            autoFocus
            value={query}
            onChange={(event) => onQueryChange(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && commands[0]) {
                event.preventDefault();
                onRun(commands[0]);
              }
            }}
            aria-label={t('command.title')}
            placeholder={t('command.placeholder')}
          />
          <kbd>Esc</kbd>
        </div>
        <h2 id="command-title">{t('command.title')}</h2>
        <div className="command-list">
          {commands.map((command) => (
            <button type="button" className="command-item" key={command.id} onClick={() => onRun(command)}>
              <span>
                <strong>{command.title}</strong>
                <small>{command.group} · {command.hint}</small>
              </span>
              {command.shortcut ? <kbd>{command.shortcut}</kbd> : null}
            </button>
          ))}
          {commands.length === 0 ? <div className="empty-state">{t('command.noMatch')}</div> : null}
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
  t: (key: string) => string;
}) {
  const title = target.kind === 'reminder' ? target.item.title : target.item.subject;
  const payload = JSON.stringify(target.item, null, 2);

  return (
    <aside className="inspector-drawer" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
      <div className="inspector-heading">
        <div>
          <p className="eyebrow">{target.kind} {t('inspector.payload').toLowerCase()}</p>
          <h2 id="inspector-title">{title}</h2>
        </div>
        <button type="button" className="row-actions-close" onClick={onClose} aria-label={t('actions.closeInspector')}>
          <XCircle size={18} aria-hidden="true" />
        </button>
      </div>
      {target.kind === 'reminder' ? (
        <PipelineTimeline status={target.item.status} variant="drawer" ariaLabel={t('aria.deliveryPipeline')} t={t} />
      ) : (
        <PipelineTimeline deliveryStatus={target.item.status} variant="drawer" ariaLabel={t('aria.deliveryPipeline')} t={t} />
      )}
      <pre>{payload}</pre>
    </aside>
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
  t: (key: string) => string;
}) {
  const displayName = fullName(user);

  return (
    <section className="profile-grid" id="profile" aria-label={t('aria.profileSettings')}>
      <section className="panel profile-card" aria-labelledby="profile-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('profile.userInfo')}</p>
            <h2 id="profile-title">{t('heading.profile.title')}</h2>
          </div>
          {statusBadge(user.role, t)}
        </div>

        <div className="profile-identity">
          <div className="profile-avatar" aria-hidden="true">{profileInitial(user)}</div>
          <div>
            <strong>{displayName || user.email}</strong>
            <span>{user.role}</span>
          </div>
        </div>

        <form className="profile-form" onSubmit={onProfileSubmit}>
          <div className="form-row">
            <label>
              {t('auth.firstName')}
              <input
                type="text"
                value={profileForm.firstName}
                onChange={(event) => onProfileChange({ ...profileForm, firstName: event.target.value })}
                autoComplete="given-name"
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
                maxLength={80}
                required
              />
            </label>
          </div>
          <label>
            {t('auth.phoneNumber')}
            <input
              type="tel"
              value={profileForm.phoneNumber}
              onChange={(event) => onProfileChange({ ...profileForm, phoneNumber: event.target.value })}
              autoComplete="tel"
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
          {profileStatus ? <p className={profileStatus.tone === 'success' ? 'form-success' : 'form-error'}>{profileStatus.message}</p> : null}
          <button type="submit" className="primary-action" disabled={profileSubmitting}>
            {profileSubmitting ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <Save size={18} aria-hidden="true" />}
            {t('actions.saveProfile')}
          </button>
        </form>

        <dl className="profile-fields">
          <div>
            <dt>{t('auth.email')}</dt>
            <dd>{user.email}</dd>
          </div>
          <div>
            <dt>{t('profile.userId')}</dt>
            <dd>{user.id}</dd>
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

      <section className="panel security-panel" aria-labelledby="security-title">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">{t('profile.security')}</p>
            <h2 id="security-title">{t('profile.password')}</h2>
          </div>
          <KeyRound size={20} aria-hidden="true" />
        </div>

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
  t: (key: string) => string;
}) {
  return (
    <form className="security-form" onSubmit={onSubmit}>
      <label>
        {t('password.current')}
        <input
          id="current-password-input"
          type="password"
          value={form.currentPassword}
          onChange={(event) => onChange({ ...form, currentPassword: event.target.value })}
          autoComplete="current-password"
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
          minLength={8}
          maxLength={128}
          required
        />
      </label>
      {status ? <p className={status.tone === 'success' ? 'form-success' : 'form-error'}>{status.message}</p> : null}
      <button type="submit" className="primary-action" disabled={submitting}>
        {submitting ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <KeyRound size={18} aria-hidden="true" />}
        {t('actions.changePassword')}
      </button>
    </form>
  );
}

export function PipelineTimeline({
  status,
  deliveryStatus,
  variant,
  ariaLabel,
  t
}: {
  status?: ReminderStatus;
  deliveryStatus?: DeliveryStatus;
  variant?: 'drawer';
  ariaLabel?: string;
  t?: (key: string) => string;
}) {
  const stages = pipelineStages(status, deliveryStatus);

  return (
    <div className={`pipeline-timeline ${variant === 'drawer' ? 'drawer' : ''}`} aria-label={ariaLabel ?? 'Delivery pipeline'}>
      {stages.map((stage) => (
        <span className={stage.state} key={stage.labelKey}>
          <i />
          {t ? t(stage.labelKey) : stage.labelKey}
        </span>
      ))}
    </div>
  );
}

export function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div className="metric-icon">{icon}</div>
      <div className="metric-copy">
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <span className="metric-spark" aria-hidden="true">
        <i />
        <i />
        <i />
        <i />
      </span>
    </article>
  );
}

export function ThemeToggle({ theme, onToggle, t }: { theme: ThemeMode; onToggle: () => void; t: (key: string) => string }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';
  const title = nextTheme === 'dark' ? t('theme.switchDark') : t('theme.switchLight');

  return (
    <button
      type="button"
      className="icon-action theme-toggle"
      onClick={onToggle}
      title={title}
      aria-label={title}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{theme === 'dark' ? t('theme.light') : t('theme.dark')}</span>
    </button>
  );
}
