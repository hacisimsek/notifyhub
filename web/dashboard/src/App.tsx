import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Edit3,
  Filter,
  History,
  Loader2,
  LogOut,
  Mail,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Trash2,
  XCircle
} from 'lucide-react';
import {
  AuthResponse,
  Channel,
  NotificationLog,
  Reminder,
  ReminderPayload,
  UserSummary,
  createReminder,
  currentUser,
  deleteReminder,
  listNotifications,
  listReminders,
  login,
  register,
  updateReminder
} from './api';
import type { DeliveryStatus } from './api';

type AuthMode = 'login' | 'register';
type NotificationStatusFilter = 'ALL' | DeliveryStatus;
type NotificationChannelFilter = 'ALL' | Channel;

type ReminderForm = {
  title: string;
  message: string;
  scheduledFor: string;
  channel: Channel;
  recipient: string;
};

const TOKEN_KEY = 'notifyhub.dashboard.token';
const CHANNELS: Channel[] = ['EMAIL', 'SMS', 'PUSH'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'SENT', 'FAILED', 'RETRYING'];

const emptyReminderForm = (): ReminderForm => ({
  title: '',
  message: '',
  scheduledFor: toDateTimeLocal(new Date(Date.now() + 15 * 60 * 1000).toISOString()),
  channel: 'EMAIL',
  recipient: ''
});

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<UserSummary | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [form, setForm] = useState<ReminderForm>(() => emptyReminderForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<NotificationStatusFilter>('ALL');
  const [notificationChannelFilter, setNotificationChannelFilter] = useState<NotificationChannelFilter>('ALL');
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    if (!token) {
      return;
    }

    currentUser(token)
      .then((profile) => {
        setUser(profile);
        return refreshData(token);
      })
      .catch(() => {
        localStorage.removeItem(TOKEN_KEY);
        setToken(null);
        setUser(null);
      });
  }, [token]);

  const metrics = useMemo(() => {
    const scheduled = reminders.filter((reminder) => reminder.status === 'SCHEDULED').length;
    const triggered = reminders.filter((reminder) => reminder.status === 'TRIGGERED').length;
    const sent = notifications.filter((notification) => notification.status === 'SENT').length;
    const failed = notifications.filter((notification) => notification.status === 'FAILED').length;
    const retrying = notifications.filter((notification) => notification.status === 'RETRYING').length;
    const totalAttempts = notifications.reduce((sum, notification) => sum + notification.attemptCount, 0);

    return { scheduled, triggered, sent, failed, retrying, totalAttempts };
  }, [reminders, notifications]);

  const filteredNotifications = useMemo(() => notifications.filter((notification) => {
    const matchesStatus = notificationStatusFilter === 'ALL' || notification.status === notificationStatusFilter;
    const matchesChannel = notificationChannelFilter === 'ALL' || notification.channel === notificationChannelFilter;
    return matchesStatus && matchesChannel;
  }), [notifications, notificationChannelFilter, notificationStatusFilter]);

  async function refreshData(authToken = token) {
    if (!authToken) {
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const [nextReminders, nextNotifications] = await Promise.all([
        listReminders(authToken),
        listNotifications(authToken)
      ]);
      setReminders(nextReminders);
      setNotifications(nextNotifications);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function submitAuth(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError(null);

    try {
      const response: AuthResponse = authMode === 'login'
        ? await login(email, password)
        : await register(email, password);
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      setPassword('');
      await refreshData(response.accessToken);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function submitReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

    setLoading(true);
    setError(null);

    const payload: ReminderPayload = {
      title: form.title.trim(),
      message: form.message.trim(),
      scheduledFor: new Date(form.scheduledFor).toISOString(),
      channel: form.channel,
      recipient: form.recipient.trim()
    };

    try {
      if (editingId) {
        await updateReminder(token, editingId, payload);
      } else {
        await createReminder(token, payload);
      }
      setForm(emptyReminderForm());
      setEditingId(null);
      await refreshData(token);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setLoading(false);
    }
  }

  async function removeReminder(id: string) {
    if (!token) {
      return;
    }

    setError(null);
    try {
      await deleteReminder(token, id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyReminderForm());
      }
      await refreshData(token);
    } catch (err) {
      setError(formatError(err));
    }
  }

  function startEditing(reminder: Reminder) {
    setEditingId(reminder.id);
    setForm({
      title: reminder.title,
      message: reminder.message ?? '',
      scheduledFor: toDateTimeLocal(reminder.scheduledFor),
      channel: reminder.channel,
      recipient: reminder.recipient
    });
  }

  function signOut() {
    localStorage.removeItem(TOKEN_KEY);
    setToken(null);
    setUser(null);
    setReminders([]);
    setNotifications([]);
    setEditingId(null);
    setForm(emptyReminderForm());
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="brand-row">
            <div className="brand-mark">
              <Bell size={22} aria-hidden="true" />
            </div>
            <div>
              <h1 id="auth-title">NotifyHub</h1>
              <p>Reminder operations dashboard</p>
            </div>
          </div>

          <div className="auth-tabs" role="tablist" aria-label="Authentication mode">
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              Login
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              Register
            </button>
          </div>

          <form className="stack-form" onSubmit={submitAuth}>
            <label>
              Email
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="user@example.com"
                autoComplete="email"
                required
              />
            </label>
            <label>
              Password
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="secret123"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={6}
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="primary-action" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
              {authMode === 'login' ? 'Sign in' : 'Create account'}
            </button>
          </form>
        </section>
      </main>
    );
  }

  if (!user) {
    return null;
  }

  const authenticatedUser = user;

  return (
    <main className="app-shell">
      <aside className="side-nav" aria-label="Primary">
        <div className="brand-row compact">
          <div className="brand-mark">
            <Bell size={20} aria-hidden="true" />
          </div>
          <span>NotifyHub</span>
        </div>
        <nav>
          <a href="#reminders"><CalendarClock size={18} aria-hidden="true" />Reminders</a>
          <a href="#notifications"><History size={18} aria-hidden="true" />History</a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <div>
            <p className="eyebrow">Operations</p>
            <h1>Reminder delivery dashboard</h1>
          </div>
          <div className="top-actions">
            <button type="button" className="icon-action" onClick={() => refreshData()} disabled={refreshing} title="Refresh data">
              <RefreshCw className={refreshing ? 'spin' : ''} size={18} aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <button type="button" className="icon-action" onClick={signOut} title="Sign out">
              <LogOut size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
        </header>

        {error ? <div className="alert-error">{error}</div> : null}

        <section className="metric-grid" aria-label="Delivery metrics">
          <Metric label="Scheduled" value={metrics.scheduled} icon={<CalendarClock size={20} />} tone="blue" />
          <Metric label="Triggered" value={metrics.triggered} icon={<Send size={20} />} tone="purple" />
          <Metric label="Sent" value={metrics.sent} icon={<CheckCircle2 size={20} />} tone="green" />
          <Metric label="Failed" value={metrics.failed} icon={<XCircle size={20} />} tone="red" />
          <Metric label="Retrying" value={metrics.retrying} icon={<RefreshCw size={20} />} tone="amber" />
          <Metric label="Attempts" value={metrics.totalAttempts} icon={<Clock3 size={20} />} tone="slate" />
        </section>

        <section className="content-grid">
          <section className="panel" id="reminders" aria-labelledby="reminders-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Create and manage</p>
                <h2 id="reminders-title">Reminders</h2>
              </div>
              <span className="user-pill">{authenticatedUser.email}</span>
            </div>

            <form className="reminder-form" onSubmit={submitReminder}>
              <div className="form-row">
                <label>
                  Title
                  <input
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    maxLength={140}
                    required
                  />
                </label>
                <label>
                  Scheduled for
                  <input
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
                    required
                  />
                </label>
              </div>

              <label>
                Message
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  maxLength={1000}
                  rows={3}
                />
              </label>

              <div className="form-row">
                <fieldset className="segmented-control">
                  <legend>Channel</legend>
                  {CHANNELS.map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      className={form.channel === channel ? 'active' : ''}
                      onClick={() => setForm({ ...form, channel })}
                    >
                      {channelIcon(channel)}
                      {channel}
                    </button>
                  ))}
                </fieldset>
                <label>
                  Recipient
                  <input
                    value={form.recipient}
                    onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                    placeholder={recipientPlaceholder(form.channel)}
                    maxLength={320}
                    required
                  />
                </label>
              </div>

              <div className="form-actions">
                {editingId ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyReminderForm());
                    }}
                  >
                    Cancel edit
                  </button>
                ) : null}
                <button type="submit" className="primary-action" disabled={loading}>
                  {editingId ? <Save size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                  {editingId ? 'Save reminder' : 'Add reminder'}
                </button>
              </div>
            </form>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Channel</th>
                    <th>Scheduled</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {reminders.map((reminder) => (
                    <tr key={reminder.id}>
                      <td>
                        <strong>{reminder.title}</strong>
                        <span>{reminder.recipient}</span>
                      </td>
                      <td>{channelBadge(reminder.channel)}</td>
                      <td>{formatDate(reminder.scheduledFor)}</td>
                      <td>{statusBadge(reminder.status)}</td>
                      <td className="row-actions">
                        <button type="button" onClick={() => startEditing(reminder)} title="Edit reminder">
                          <Edit3 size={16} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => removeReminder(reminder.id)} title="Delete reminder">
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                  {reminders.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="empty-state">No reminders yet.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>

          <section className="panel" id="notifications" aria-labelledby="notifications-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Delivery log</p>
                <h2 id="notifications-title">Notifications</h2>
              </div>
              <span className="history-count">{filteredNotifications.length} / {notifications.length}</span>
            </div>

            <div className="notification-toolbar" aria-label="Notification filters">
              <div className="filter-group">
                <span><Filter size={15} aria-hidden="true" />Status</span>
                <div className="filter-buttons">
                  {(['ALL', ...DELIVERY_STATUSES] as NotificationStatusFilter[]).map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={notificationStatusFilter === status ? 'active' : ''}
                      onClick={() => setNotificationStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <span>{channelIcon('EMAIL')}Channel</span>
                <div className="filter-buttons">
                  {(['ALL', ...CHANNELS] as NotificationChannelFilter[]).map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      className={notificationChannelFilter === channel ? 'active' : ''}
                      onClick={() => setNotificationChannelFilter(channel)}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="notification-list">
              {filteredNotifications.map((notification) => (
                <article className="notification-item" key={notification.id}>
                  <div className="notification-icon">{channelIcon(notification.channel)}</div>
                  <div>
                    <div className="notification-title">
                      <strong>{notification.subject}</strong>
                      {statusBadge(notification.status)}
                    </div>
                    <p>{notification.message}</p>
                    <div className="notification-meta">
                      <span>
                        {notification.recipient} · {formatDate(notification.createdAt)} · Attempts: {notification.attemptCount}
                      </span>
                      {notification.lastAttemptAt ? <span>Last attempt: {formatDate(notification.lastAttemptAt)}</span> : null}
                      {notification.failureReason ? <span>{notification.failureReason}</span> : null}
                    </div>
                  </div>
                </article>
              ))}
              {notifications.length === 0 ? <div className="empty-state">No delivery history yet.</div> : null}
              {notifications.length > 0 && filteredNotifications.length === 0 ? (
                <div className="empty-state">No notifications match the selected filters.</div>
              ) : null}
            </div>
          </section>
        </section>
      </section>
    </main>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
  return (
    <article className={`metric-card ${tone}`}>
      <div>{icon}</div>
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

function channelIcon(channel: Channel) {
  if (channel === 'EMAIL') {
    return <Mail size={16} aria-hidden="true" />;
  }
  if (channel === 'SMS') {
    return <Smartphone size={16} aria-hidden="true" />;
  }
  return <Bell size={16} aria-hidden="true" />;
}

function channelBadge(channel: Channel) {
  return <span className={`badge channel ${channel.toLowerCase()}`}>{channelIcon(channel)}{channel}</span>;
}

function statusBadge(status: string) {
  return <span className={`badge status ${status.toLowerCase()}`}>{status}</span>;
}

function recipientPlaceholder(channel: Channel) {
  if (channel === 'EMAIL') {
    return 'user@example.com';
  }
  if (channel === 'SMS') {
    return '+905551112233';
  }
  return 'push-target-id';
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    dateStyle: 'medium',
    timeStyle: 'short'
  }).format(new Date(value));
}

function toDateTimeLocal(value: string) {
  const date = new Date(value);
  const offset = date.getTimezoneOffset() * 60 * 1000;
  return new Date(date.getTime() - offset).toISOString().slice(0, 16);
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}
