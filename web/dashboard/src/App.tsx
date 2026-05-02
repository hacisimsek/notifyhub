import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Code2,
  Cpu,
  Edit3,
  Filter,
  History,
  Loader2,
  LogOut,
  Mail,
  Moon,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Smartphone,
  Sun,
  Terminal,
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
import type { DeliveryStatus, NotificationFilters, ReminderFilters, ReminderStatus } from './api';

type AuthMode = 'login' | 'register';
type ReminderStatusFilter = 'ALL' | ReminderStatus;
type ReminderChannelFilter = 'ALL' | Channel;
type NotificationStatusFilter = 'ALL' | DeliveryStatus;
type NotificationChannelFilter = 'ALL' | Channel;
type ThemeMode = 'light' | 'dark';
type DashboardView = 'reminders' | 'history';
type InspectorTarget = { kind: 'reminder'; item: Reminder } | { kind: 'notification'; item: NotificationLog };
type CommandItem = {
  id: string;
  title: string;
  hint: string;
  group: string;
  shortcut?: string;
  run: () => void | Promise<void>;
};
type EventStreamEntry = {
  id: string;
  time: string;
  command: string;
  detail: string;
  tone: string;
  target?: InspectorTarget;
};
type PipelineStageState = 'done' | 'active' | 'queued' | 'error';

type ReminderForm = {
  title: string;
  message: string;
  scheduledFor: string;
  channel: Channel;
  recipient: string;
};

const TOKEN_KEY = 'notifyhub.dashboard.token';
const THEME_KEY = 'notifyhub.dashboard.theme';
const CHANNELS: Channel[] = ['EMAIL', 'SMS', 'PUSH'];
const REMINDER_STATUSES: ReminderStatus[] = ['SCHEDULED', 'TRIGGERED', 'CANCELLED'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'SENT', 'FAILED', 'RETRYING'];
const DASHBOARD_ROUTES: Record<DashboardView, string> = {
  reminders: '#reminders',
  history: '#history'
};

const emptyReminderForm = (): ReminderForm => ({
  title: '',
  message: '',
  scheduledFor: toDateTimeLocal(new Date(Date.now() + 15 * 60 * 1000).toISOString()),
  channel: 'EMAIL',
  recipient: ''
});

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [theme, setTheme] = useState<ThemeMode>(() => initialTheme());
  const [activeView, setActiveView] = useState<DashboardView>(() => currentDashboardView());
  const [user, setUser] = useState<UserSummary | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [visibleReminders, setVisibleReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [visibleNotifications, setVisibleNotifications] = useState<NotificationLog[]>([]);
  const [form, setForm] = useState<ReminderForm>(() => emptyReminderForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [reminderStatusFilter, setReminderStatusFilter] = useState<ReminderStatusFilter>('ALL');
  const [reminderChannelFilter, setReminderChannelFilter] = useState<ReminderChannelFilter>('ALL');
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<NotificationStatusFilter>('ALL');
  const [notificationChannelFilter, setNotificationChannelFilter] = useState<NotificationChannelFilter>('ALL');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const isAuthenticated = Boolean(token && user);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('color-scheme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    const syncRoute = () => setActiveView(currentDashboardView());

    window.addEventListener('hashchange', syncRoute);
    window.addEventListener('popstate', syncRoute);

    return () => {
      window.removeEventListener('hashchange', syncRoute);
      window.removeEventListener('popstate', syncRoute);
    };
  }, []);

  useEffect(() => {
    function handleShortcut(event: KeyboardEvent) {
      const key = event.key.toLowerCase();

      if (isAuthenticated && (event.metaKey || event.ctrlKey) && key === 'k') {
        event.preventDefault();
        setCommandPaletteOpen(true);
      }

      if (event.key === 'Escape') {
        setCommandPaletteOpen(false);
        setInspectorTarget(null);
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isAuthenticated]);

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

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    refreshVisibleReminders(token);
  }, [reminderChannelFilter, reminderStatusFilter]);

  useEffect(() => {
    if (!token || !user) {
      return;
    }

    refreshVisibleNotifications(token);
  }, [notificationChannelFilter, notificationStatusFilter]);

  const metrics = useMemo(() => {
    const scheduled = reminders.filter((reminder) => reminder.status === 'SCHEDULED').length;
    const triggered = reminders.filter((reminder) => reminder.status === 'TRIGGERED').length;
    const sent = notifications.filter((notification) => notification.status === 'SENT').length;
    const failed = notifications.filter((notification) => notification.status === 'FAILED').length;
    const retrying = notifications.filter((notification) => notification.status === 'RETRYING').length;
    const totalAttempts = notifications.reduce((sum, notification) => sum + notification.attemptCount, 0);

    return { scheduled, triggered, sent, failed, retrying, totalAttempts };
  }, [reminders, notifications]);

  const eventStream = useMemo(() => buildEventStream(reminders, notifications), [reminders, notifications]);

  const commandItems = useMemo<CommandItem[]>(() => [
    {
      id: 'open-reminders',
      title: 'Open reminders',
      hint: 'Jump to the create and schedule workflow',
      group: 'Navigation',
      shortcut: 'G R',
      run: () => openDashboardView('reminders')
    },
    {
      id: 'open-history',
      title: 'Open history',
      hint: 'Inspect delivery events and notification attempts',
      group: 'Navigation',
      shortcut: 'G H',
      run: () => openDashboardView('history')
    },
    {
      id: 'focus-create',
      title: 'Create reminder',
      hint: 'Open the reminder form and focus the title field',
      group: 'Workflow',
      shortcut: 'N',
      run: () => {
        openDashboardView('reminders');
        window.setTimeout(() => document.getElementById('reminder-title-input')?.focus(), 0);
      }
    },
    {
      id: 'refresh-data',
      title: 'Refresh data',
      hint: 'Pull latest reminders and delivery events',
      group: 'Runtime',
      shortcut: 'R',
      run: () => refreshData()
    },
    {
      id: 'failed-deliveries',
      title: 'Filter failed deliveries',
      hint: 'Switch to history and isolate failed notifications',
      group: 'Debug',
      shortcut: 'F',
      run: () => {
        openDashboardView('history');
        setNotificationStatusFilter('FAILED');
      }
    },
    {
      id: 'email-reminders',
      title: 'Filter email reminders',
      hint: 'Show EMAIL reminders in the scheduling table',
      group: 'Debug',
      shortcut: 'E',
      run: () => {
        openDashboardView('reminders');
        setReminderChannelFilter('EMAIL');
      }
    },
    {
      id: 'inspect-latest',
      title: 'Inspect latest event',
      hint: notifications[0]?.subject ?? reminders[0]?.title ?? 'No payload available yet',
      group: 'Inspector',
      shortcut: 'I',
      run: () => {
        if (notifications[0]) {
          setInspectorTarget({ kind: 'notification', item: notifications[0] });
          return;
        }
        if (reminders[0]) {
          setInspectorTarget({ kind: 'reminder', item: reminders[0] });
        }
      }
    },
    {
      id: 'toggle-theme',
      title: `Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`,
      hint: 'Flip the dashboard color mode',
      group: 'Preferences',
      shortcut: 'T',
      run: () => toggleTheme()
    }
  ], [notifications, reminders, theme]);

  const filteredCommandItems = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return commandItems;
    }

    return commandItems.filter((command) => {
      return [command.title, command.hint, command.group].join(' ').toLowerCase().includes(query);
    });
  }, [commandItems, commandQuery]);

  async function refreshData(authToken = token) {
    if (!authToken) {
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const reminderFilters = selectedReminderFilters();
      const notificationFilters = selectedNotificationFilters();
      const allRemindersRequest = listReminders(authToken);
      const visibleRemindersRequest = hasReminderFilters(reminderFilters)
        ? listReminders(authToken, reminderFilters)
        : allRemindersRequest;
      const allNotificationsRequest = listNotifications(authToken);
      const visibleNotificationsRequest = hasNotificationFilters(notificationFilters)
        ? listNotifications(authToken, notificationFilters)
        : allNotificationsRequest;
      const [nextReminders, nextVisibleReminders, nextNotifications, nextVisibleNotifications] = await Promise.all([
        allRemindersRequest,
        visibleRemindersRequest,
        allNotificationsRequest,
        visibleNotificationsRequest
      ]);
      setReminders(nextReminders);
      setVisibleReminders(nextVisibleReminders);
      setNotifications(nextNotifications);
      setVisibleNotifications(nextVisibleNotifications);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshVisibleReminders(authToken = token) {
    if (!authToken) {
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const nextReminders = await listReminders(authToken, selectedReminderFilters());
      setVisibleReminders(nextReminders);
    } catch (err) {
      setError(formatError(err));
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshVisibleNotifications(authToken = token) {
    if (!authToken) {
      return;
    }

    setRefreshing(true);
    setError(null);
    try {
      const nextNotifications = await listNotifications(authToken, selectedNotificationFilters());
      setVisibleNotifications(nextNotifications);
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
    setVisibleReminders([]);
    setNotifications([]);
    setVisibleNotifications([]);
    setEditingId(null);
    setForm(emptyReminderForm());
  }

  function toggleTheme() {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }

  function openDashboardView(nextView: DashboardView) {
    setActiveView(nextView);
    const nextRoute = DASHBOARD_ROUTES[nextView];

    if (window.location.hash !== nextRoute) {
      window.history.pushState(null, '', nextRoute);
    }
  }

  async function runCommand(command: CommandItem) {
    await command.run();
    setCommandPaletteOpen(false);
    setCommandQuery('');
  }

  function selectedReminderFilters(): ReminderFilters {
    return {
      status: reminderStatusFilter === 'ALL' ? undefined : reminderStatusFilter,
      channel: reminderChannelFilter === 'ALL' ? undefined : reminderChannelFilter
    };
  }

  function selectedNotificationFilters(): NotificationFilters {
    return {
      status: notificationStatusFilter === 'ALL' ? undefined : notificationStatusFilter,
      channel: notificationChannelFilter === 'ALL' ? undefined : notificationChannelFilter
    };
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-heading">
            <div className="brand-row">
              <div className="brand-mark">
                <Bell size={22} aria-hidden="true" />
              </div>
              <div>
                <h1 id="auth-title">NotifyHub</h1>
                <p>Reminder operations dashboard</p>
              </div>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
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
  const heading = activeView === 'history'
    ? { eyebrow: 'Delivery log', title: 'Notification history' }
    : { eyebrow: 'Operations', title: 'Reminder delivery dashboard' };

  return (
    <main className="app-shell">
      <aside className="side-nav" aria-label="Primary">
        <div className="brand-row compact">
          <div className="brand-mark">
            <Bell size={20} aria-hidden="true" />
          </div>
          <span>NotifyHub</span>
        </div>
        <div className="nav-console" aria-hidden="true">
          <span>$ notifyhub</span>
          <strong>watch --live</strong>
        </div>
        <nav>
          <a
            href={DASHBOARD_ROUTES.reminders}
            aria-current={activeView === 'reminders' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              openDashboardView('reminders');
            }}
          >
            <CalendarClock size={18} aria-hidden="true" />Reminders
          </a>
          <a
            href={DASHBOARD_ROUTES.history}
            aria-current={activeView === 'history' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              openDashboardView('history');
            }}
          >
            <History size={18} aria-hidden="true" />History
          </a>
        </nav>
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <div>
            <p className="eyebrow">{heading.eyebrow}</p>
            <h1>{heading.title}</h1>
          </div>
          <div className="top-actions">
            <span className="account-chip">{authenticatedUser.email}</span>
            <button type="button" className="icon-action command-trigger" onClick={() => setCommandPaletteOpen(true)} title="Open command palette">
              <Terminal size={18} aria-hidden="true" />
              <span>Command</span>
              <kbd>⌘K</kbd>
            </button>
            <ThemeToggle theme={theme} onToggle={toggleTheme} />
            <button type="button" className="icon-action" onClick={() => refreshData()} disabled={refreshing} title="Refresh data">
              <RefreshCw className={refreshing ? 'spin' : ''} size={18} aria-hidden="true" />
              <span>Refresh</span>
            </button>
            <button type="button" className="icon-action" onClick={signOut} title="Sign out">
              <LogOut size={18} aria-hidden="true" />
              <span>Sign out</span>
            </button>
          </div>
          <div className="system-strip" aria-label="Runtime signals">
            <span className="system-pill">
              <Terminal size={15} aria-hidden="true" />
              <code>gateway:8080</code>
              <span className="pulse-dot" />
            </span>
            <span className="system-pill">
              <Cpu size={15} aria-hidden="true" />
              <code>scheduler:armed</code>
              <span className="pulse-dot" />
            </span>
            <span className="system-pill">
              <Code2 size={15} aria-hidden="true" />
              <code>events:streaming</code>
              <span className="pulse-dot" />
            </span>
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

        <section className="developer-grid" aria-label="Developer cockpit">
          <ServiceTopology metrics={metrics} />
          <LiveEventConsole events={eventStream} onInspect={setInspectorTarget} />
        </section>

        <section className="content-grid">
          {activeView === 'reminders' ? (
          <section className="panel" id="reminders" aria-labelledby="reminders-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Create and manage</p>
                <h2 id="reminders-title">Reminders</h2>
              </div>
              <div className="heading-actions">
                <span className="history-count">{visibleReminders.length} / {reminders.length}</span>
              </div>
            </div>

            <form className="reminder-form" onSubmit={submitReminder}>
              <div className="form-row">
                <label>
                  Title
                  <input
                    id="reminder-title-input"
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

            <div className="notification-toolbar" aria-label="Reminder filters">
              <div className="filter-group">
                <span><Filter size={15} aria-hidden="true" />Status</span>
                <div className="filter-buttons">
                  {(['ALL', ...REMINDER_STATUSES] as ReminderStatusFilter[]).map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={reminderStatusFilter === status ? 'active' : ''}
                      onClick={() => setReminderStatusFilter(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <span>{channelIcon('EMAIL')}Channel</span>
                <div className="filter-buttons">
                  {(['ALL', ...CHANNELS] as ReminderChannelFilter[]).map((channel) => (
                    <button
                      type="button"
                      key={channel}
                      className={reminderChannelFilter === channel ? 'active' : ''}
                      onClick={() => setReminderChannelFilter(channel)}
                    >
                      {channel}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Title</th>
                    <th>Channel</th>
                    <th>Scheduled</th>
                    <th>Pipeline</th>
                    <th>Status</th>
                    <th aria-label="Actions" />
                  </tr>
                </thead>
                <tbody>
                  {visibleReminders.map((reminder) => (
                    <tr key={reminder.id}>
                      <td>
                        <strong>{reminder.title}</strong>
                        <span>{reminder.recipient}</span>
                      </td>
                      <td>{channelBadge(reminder.channel)}</td>
                      <td>{formatDate(reminder.scheduledFor)}</td>
                      <td><PipelineTimeline status={reminder.status} /></td>
                      <td>{statusBadge(reminder.status)}</td>
                      <td className="row-actions">
                        <button type="button" onClick={() => setInspectorTarget({ kind: 'reminder', item: reminder })} title="Inspect reminder payload">
                          <Code2 size={16} aria-hidden="true" />
                        </button>
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
                      <td colSpan={6} className="empty-state">No reminders yet.</td>
                    </tr>
                  ) : null}
                  {reminders.length > 0 && visibleReminders.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="empty-state">No reminders match the selected filters.</td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </section>
          ) : null}

          {activeView === 'history' ? (
          <section className="panel" id="history" aria-labelledby="notifications-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Delivery log</p>
                <h2 id="notifications-title">History</h2>
              </div>
              <span className="history-count">{visibleNotifications.length} / {notifications.length}</span>
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
              {visibleNotifications.map((notification) => (
                <article className="notification-item" key={notification.id}>
                  <div className="notification-icon">{channelIcon(notification.channel)}</div>
                  <div>
                    <div className="notification-title">
                      <strong>{notification.subject}</strong>
                      {statusBadge(notification.status)}
                    </div>
                    <PipelineTimeline deliveryStatus={notification.status} />
                    <p>{notification.message}</p>
                    <div className="notification-meta">
                      <span>
                        {notification.recipient} · {formatDate(notification.createdAt)} · Attempts: {notification.attemptCount}
                      </span>
                      {notification.lastAttemptAt ? <span>Last attempt: {formatDate(notification.lastAttemptAt)}</span> : null}
                      {notification.failureReason ? <span>{notification.failureReason}</span> : null}
                    </div>
                    <button type="button" className="inline-inspect" onClick={() => setInspectorTarget({ kind: 'notification', item: notification })}>
                      Inspect payload
                    </button>
                  </div>
                </article>
              ))}
              {notifications.length === 0 ? <div className="empty-state">No delivery history yet.</div> : null}
              {notifications.length > 0 && visibleNotifications.length === 0 ? (
                <div className="empty-state">No notifications match the selected filters.</div>
              ) : null}
            </div>
          </section>
          ) : null}
        </section>
      </section>

      {commandPaletteOpen ? (
        <CommandPalette
          query={commandQuery}
          commands={filteredCommandItems}
          onQueryChange={setCommandQuery}
          onRun={runCommand}
          onClose={() => {
            setCommandPaletteOpen(false);
            setCommandQuery('');
          }}
        />
      ) : null}

      {inspectorTarget ? (
        <InspectorDrawer target={inspectorTarget} onClose={() => setInspectorTarget(null)} />
      ) : null}
    </main>
  );
}

function ServiceTopology({ metrics }: { metrics: { scheduled: number; triggered: number; sent: number; failed: number; retrying: number; totalAttempts: number } }) {
  const services = [
    { key: 'gateway', name: 'Gateway', detail: 'REST 8080', meta: `${metrics.totalAttempts} attempts` },
    { key: 'auth', name: 'Auth', detail: 'JWT', meta: 'identity' },
    { key: 'reminder', name: 'Reminder', detail: 'Scheduler', meta: `${metrics.scheduled} scheduled` },
    { key: 'kafka', name: 'Kafka', detail: 'Event bus', meta: `${metrics.triggered} triggered` },
    { key: 'notification', name: 'Notify', detail: 'Delivery', meta: `${metrics.sent} sent` },
    { key: 'storage', name: 'Postgres', detail: 'State', meta: `${metrics.failed + metrics.retrying} watch` }
  ];

  return (
    <section className="cockpit-card topology-card" aria-labelledby="topology-title">
      <div className="cockpit-heading">
        <div>
          <p className="eyebrow">Runtime map</p>
          <h2 id="topology-title">Service topology</h2>
        </div>
        <span className="live-chip"><span className="pulse-dot" />live</span>
      </div>

      <div className="topology-map">
        <svg className="topology-lines" viewBox="0 0 640 300" role="img" aria-label="Service dependencies">
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

function LiveEventConsole({ events, onInspect }: { events: EventStreamEntry[]; onInspect: (target: InspectorTarget) => void }) {
  return (
    <section className="cockpit-card console-card" aria-labelledby="console-title">
      <div className="cockpit-heading">
        <div>
          <p className="eyebrow">Event stream</p>
          <h2 id="console-title">Live console</h2>
        </div>
        <span className="live-chip"><span className="pulse-dot" />tail -f</span>
      </div>

      <div className="console-window" role="log" aria-live="polite">
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

function CommandPalette({
  query,
  commands,
  onQueryChange,
  onRun,
  onClose
}: {
  query: string;
  commands: CommandItem[];
  onQueryChange: (query: string) => void;
  onRun: (command: CommandItem) => void;
  onClose: () => void;
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
            aria-label="Command palette"
            placeholder="Type a command, route, filter, or payload..."
          />
          <kbd>Esc</kbd>
        </div>
        <h2 id="command-title">Command palette</h2>
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
          {commands.length === 0 ? <div className="empty-state">No command matched.</div> : null}
        </div>
      </section>
    </div>
  );
}

function InspectorDrawer({ target, onClose }: { target: InspectorTarget; onClose: () => void }) {
  const title = target.kind === 'reminder' ? target.item.title : target.item.subject;
  const payload = JSON.stringify(target.item, null, 2);

  return (
    <aside className="inspector-drawer" role="dialog" aria-modal="true" aria-labelledby="inspector-title">
      <div className="inspector-heading">
        <div>
          <p className="eyebrow">{target.kind} payload</p>
          <h2 id="inspector-title">{title}</h2>
        </div>
        <button type="button" className="row-actions-close" onClick={onClose} aria-label="Close inspector">
          <XCircle size={18} aria-hidden="true" />
        </button>
      </div>
      {target.kind === 'reminder' ? (
        <PipelineTimeline status={target.item.status} variant="drawer" />
      ) : (
        <PipelineTimeline deliveryStatus={target.item.status} variant="drawer" />
      )}
      <pre>{payload}</pre>
    </aside>
  );
}

function PipelineTimeline({
  status,
  deliveryStatus,
  variant
}: {
  status?: ReminderStatus;
  deliveryStatus?: DeliveryStatus;
  variant?: 'drawer';
}) {
  const stages = pipelineStages(status, deliveryStatus);

  return (
    <div className={`pipeline-timeline ${variant === 'drawer' ? 'drawer' : ''}`} aria-label="Delivery pipeline">
      {stages.map((stage) => (
        <span className={stage.state} key={stage.label}>
          <i />
          {stage.label}
        </span>
      ))}
    </div>
  );
}

function Metric({ label, value, icon, tone }: { label: string; value: number; icon: React.ReactNode; tone: string }) {
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

function ThemeToggle({ theme, onToggle }: { theme: ThemeMode; onToggle: () => void }) {
  const nextTheme = theme === 'dark' ? 'light' : 'dark';

  return (
    <button
      type="button"
      className="icon-action theme-toggle"
      onClick={onToggle}
      title={`Switch to ${nextTheme} theme`}
      aria-label={`Switch to ${nextTheme} theme`}
    >
      {theme === 'dark' ? <Sun size={18} aria-hidden="true" /> : <Moon size={18} aria-hidden="true" />}
      <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
    </button>
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

function hasReminderFilters(filters: ReminderFilters) {
  return Boolean(filters.status || filters.channel);
}

function hasNotificationFilters(filters: NotificationFilters) {
  return Boolean(filters.status || filters.channel);
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

function initialTheme(): ThemeMode {
  const storedTheme = localStorage.getItem(THEME_KEY);
  if (storedTheme === 'light' || storedTheme === 'dark') {
    return storedTheme;
  }

  if (typeof window !== 'undefined' && window.matchMedia?.('(prefers-color-scheme: dark)').matches) {
    return 'dark';
  }

  return 'light';
}

function currentDashboardView(): DashboardView {
  if (typeof window === 'undefined') {
    return 'reminders';
  }

  const normalizedHash = window.location.hash.toLowerCase();
  if (normalizedHash === '#history' || normalizedHash === '#notifications') {
    return 'history';
  }

  return 'reminders';
}

function buildEventStream(reminders: Reminder[], notifications: NotificationLog[]): EventStreamEntry[] {
  const reminderEvents: EventStreamEntry[] = reminders.map((reminder) => ({
    id: `reminder-${reminder.id}`,
    time: reminder.updatedAt,
    command: `reminder.${reminder.status.toLowerCase()}`,
    detail: `${reminder.title} -> ${reminder.channel.toLowerCase()} ${reminder.recipient}`,
    tone: reminder.status.toLowerCase(),
    target: { kind: 'reminder', item: reminder }
  }));
  const notificationEvents: EventStreamEntry[] = notifications.map((notification) => ({
    id: `notification-${notification.id}`,
    time: notification.updatedAt,
    command: `notification.${notification.status.toLowerCase()}`,
    detail: `${notification.subject} -> ${notification.recipient}`,
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
      detail: 'Waiting for authenticated payloads',
      tone: 'sent'
    },
    {
      id: 'boot-scheduler',
      time: new Date().toISOString(),
      command: 'scheduler.idle',
      detail: 'No reminders in the queue',
      tone: 'scheduled'
    }
  ];
}

function formatConsoleTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function pipelineStages(status?: ReminderStatus, deliveryStatus?: DeliveryStatus): { label: string; state: PipelineStageState }[] {
  const labels = ['created', 'scheduled', 'queued', 'delivery'];
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

  return labels.map((label, index) => {
    if (failed && index === activeIndex) {
      return { label: status === 'CANCELLED' ? 'cancelled' : 'failed', state: 'error' };
    }
    if (index < activeIndex) {
      return { label, state: 'done' };
    }
    if (index === activeIndex) {
      return { label, state: 'active' };
    }
    return { label, state: 'queued' };
  });
}

function formatError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Unexpected error';
}
