import { FormEvent, ReactNode, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  Code2,
  Edit3,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  Trash2,
  User
} from 'lucide-react';
import {
  changePassword,
  createReminder,
  currentUser,
  deleteReminder,
  getLanguageMessages,
  isUnauthorized,
  listNotifications,
  listReminders,
  login,
  logout,
  register,
  updateProfile,
  updateReminder
} from './api';
import type {
  AuthResponse,
  LanguageCode,
  NotificationFilters,
  NotificationLog,
  Reminder,
  ReminderFilters,
  ReminderPayload,
  UserSummary
} from './api';
import {
  CommandPalette,
  DeparturesBoard,
  InspectorDrawer,
  LineStatus,
  LiveEventConsole,
  PipelineTimeline,
  ProfileSettingsPage,
  ServiceTopology,
  ThemeToggle
} from './dashboard/components';
import { DEFAULT_MESSAGES } from './dashboard/messages';
import {
  AUTO_REFRESH_INTERVAL_MS,
  AuthMode,
  CHANNELS,
  CommandItem,
  DASHBOARD_ROUTES,
  DELIVERY_STATUSES,
  DashboardView,
  FormStatus,
  InspectorTarget,
  LANGUAGE_KEY,
  LEGACY_TOKEN_KEY,
  NotificationChannelFilter,
  NotificationStatusFilter,
  PasswordChangeForm,
  ProfileForm,
  REMINDER_STATUSES,
  RegistrationProfileForm,
  ReminderChannelFilter,
  ReminderForm,
  ReminderStatusFilter,
  THEME_KEY,
  ThemeMode
} from './dashboard/types';
import {
  buildEventStream,
  channelBadge,
  channelIcon,
  currentDashboardView,
  defaultRecipientForChannel,
  emptyPasswordChangeForm,
  emptyRegistrationProfileForm,
  emptyReminderForm,
  formatClock,
  formatDate,
  formatDay,
  formatError,
  hasNotificationFilters,
  hasReminderFilters,
  initialLanguage,
  initialTheme,
  profileFormFromUser,
  profileInitial,
  recipientPlaceholder,
  reminderFormWithChannel,
  setDisplayLocale,
  sortRemindersNewestFirst,
  statusBadge,
  statusFilterLabel,
  toDateTimeLocal
} from './dashboard/utils';

export function App() {
  const [theme, setTheme] = useState<ThemeMode>(() => initialTheme());
  const [language, setLanguage] = useState<LanguageCode>(() => initialLanguage());
  const [messages, setMessages] = useState<Record<string, string>>(DEFAULT_MESSAGES);
  const [activeView, setActiveView] = useState<DashboardView>(() => currentDashboardView());
  const [user, setUser] = useState<UserSummary | null>(null);
  const [authMode, setAuthMode] = useState<AuthMode>('login');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [registrationProfile, setRegistrationProfile] = useState<RegistrationProfileForm>(() => emptyRegistrationProfileForm());
  const [reminders, setReminders] = useState<Reminder[]>([]);
  const [visibleReminders, setVisibleReminders] = useState<Reminder[]>([]);
  const [notifications, setNotifications] = useState<NotificationLog[]>([]);
  const [visibleNotifications, setVisibleNotifications] = useState<NotificationLog[]>([]);
  const [form, setForm] = useState<ReminderForm>(() => emptyReminderForm());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [pendingDeleteId, setPendingDeleteId] = useState<string | null>(null);
  const [reminderStatusFilter, setReminderStatusFilter] = useState<ReminderStatusFilter>('ALL');
  const [reminderChannelFilter, setReminderChannelFilter] = useState<ReminderChannelFilter>('ALL');
  const [notificationStatusFilter, setNotificationStatusFilter] = useState<NotificationStatusFilter>('ALL');
  const [notificationChannelFilter, setNotificationChannelFilter] = useState<NotificationChannelFilter>('ALL');
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [commandQuery, setCommandQuery] = useState('');
  const [inspectorTarget, setInspectorTarget] = useState<InspectorTarget | null>(null);
  const [passwordChangeForm, setPasswordChangeForm] = useState<PasswordChangeForm>(() => emptyPasswordChangeForm());
  const [passwordChangeStatus, setPasswordChangeStatus] = useState<FormStatus | null>(null);
  const [passwordSubmitting, setPasswordSubmitting] = useState(false);
  const [profileForm, setProfileForm] = useState<ProfileForm>(() => emptyRegistrationProfileForm());
  const [profileStatus, setProfileStatus] = useState<FormStatus | null>(null);
  const [profileSubmitting, setProfileSubmitting] = useState(false);
  const [loading, setLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Times and dates follow the UI language, not the browser locale, so one screen never mixes two languages.
  setDisplayLocale(language);
  const isAuthenticated = Boolean(user);
  const t = (key: string) => messages[key] ?? DEFAULT_MESSAGES[key] ?? key;
  const hasPendingWork = reminders.some((item) => item.status === 'SCHEDULED')
    || notifications.some((item) => item.status === 'PENDING' || item.status === 'RETRYING');

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document.documentElement.style.setProperty('color-scheme', theme);
    localStorage.setItem(THEME_KEY, theme);
  }, [theme]);

  useEffect(() => {
    document.documentElement.lang = language;
    localStorage.setItem(LANGUAGE_KEY, language);
    getLanguageMessages(language)
      .then((response) => setMessages({ ...DEFAULT_MESSAGES, ...response.messages }))
      .catch(() => setMessages(DEFAULT_MESSAGES));
  }, [language]);

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
        setPendingDeleteId(null);
      }
    }

    window.addEventListener('keydown', handleShortcut);

    return () => window.removeEventListener('keydown', handleShortcut);
  }, [isAuthenticated]);

  useEffect(() => {
    // Reminders are triggered and delivered asynchronously, so poll while work is still in flight.
    if (!isAuthenticated || !hasPendingWork) {
      return;
    }

    const intervalId = window.setInterval(() => {
      if (!document.hidden) {
        void refreshData({ silent: true });
      }
    }, AUTO_REFRESH_INTERVAL_MS);

    return () => window.clearInterval(intervalId);
  }, [
    isAuthenticated,
    hasPendingWork,
    reminderStatusFilter,
    reminderChannelFilter,
    notificationStatusFilter,
    notificationChannelFilter
  ]);

  useEffect(() => {
    // Earlier versions kept the access token in localStorage; the session now lives in an HttpOnly cookie.
    try {
      localStorage.removeItem(LEGACY_TOKEN_KEY);
    } catch {
      // Storage can be unavailable (private mode); nothing to clean up then.
    }

    currentUser()
      .then((profile) => {
        setUser(profile);
        return refreshData();
      })
      .catch(() => setUser(null));
  }, []);

  useEffect(() => {
    if (user) {
      setProfileForm(profileFormFromUser(user));
      setLanguage(user.preferredLanguage);
      setForm((currentForm) => {
        if (editingId || currentForm.recipient.trim()) {
          return currentForm;
        }

        return {
          ...currentForm,
          recipient: defaultRecipientForChannel(currentForm.channel, user)
        };
      });
    }
  }, [editingId, user]);

  useEffect(() => {
    if (!user) {
      return;
    }

    refreshVisibleReminders();
  }, [reminderChannelFilter, reminderStatusFilter]);

  useEffect(() => {
    if (!user) {
      return;
    }

    refreshVisibleNotifications();
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

  const eventStream = useMemo(() => buildEventStream(reminders, notifications, t), [messages, reminders, notifications]);

  const commandItems = useMemo<CommandItem[]>(() => [
    {
      id: 'open-overview',
      title: t('command.openOverview.title'),
      hint: t('command.openOverview.hint'),
      group: t('command.group.navigation'),
      shortcut: 'G O',
      run: () => openDashboardView('overview')
    },
    {
      id: 'open-reminders',
      title: t('command.openReminders.title'),
      hint: t('command.openReminders.hint'),
      group: t('command.group.navigation'),
      shortcut: 'G R',
      run: () => openDashboardView('reminders')
    },
    {
      id: 'open-history',
      title: t('command.openHistory.title'),
      hint: t('command.openHistory.hint'),
      group: t('command.group.navigation'),
      shortcut: 'G H',
      run: () => openDashboardView('history')
    },
    {
      id: 'open-profile',
      title: t('command.openProfile.title'),
      hint: t('command.openProfile.hint'),
      group: t('command.group.navigation'),
      shortcut: 'G P',
      run: () => openDashboardView('profile')
    },
    {
      id: 'focus-create',
      title: t('command.createReminder.title'),
      hint: t('command.createReminder.hint'),
      group: t('command.group.workflow'),
      shortcut: 'N',
      run: () => focusReminderForm()
    },
    {
      id: 'refresh-data',
      title: t('command.refreshData.title'),
      hint: t('command.refreshData.hint'),
      group: t('command.group.runtime'),
      shortcut: 'R',
      run: () => refreshData()
    },
    {
      id: 'failed-deliveries',
      title: t('command.failedDeliveries.title'),
      hint: t('command.failedDeliveries.hint'),
      group: t('command.group.debug'),
      shortcut: 'F',
      run: () => {
        openDashboardView('history');
        setNotificationStatusFilter('FAILED');
      }
    },
    {
      id: 'email-reminders',
      title: t('command.emailReminders.title'),
      hint: t('command.emailReminders.hint'),
      group: t('command.group.debug'),
      shortcut: 'E',
      run: () => {
        openDashboardView('reminders');
        setReminderChannelFilter('EMAIL');
      }
    },
    {
      id: 'inspect-latest',
      title: t('command.inspectLatest.title'),
      hint: notifications[0]?.subject ?? reminders[0]?.title ?? t('command.inspectLatest.empty'),
      group: t('command.group.inspector'),
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
      id: 'change-password',
      title: t('command.changePassword.title'),
      hint: t('command.changePassword.hint'),
      group: t('command.group.account'),
      shortcut: 'P',
      run: () => {
        openDashboardView('profile');
        window.setTimeout(() => document.getElementById('current-password-input')?.focus(), 0);
      }
    },
    {
      id: 'toggle-theme',
      title: theme === 'dark' ? t('theme.switchLight') : t('theme.switchDark'),
      hint: t('command.toggleTheme.hint'),
      group: t('command.group.preferences'),
      shortcut: 'T',
      run: () => toggleTheme()
    }
  ], [messages, notifications, reminders, theme]);

  const filteredCommandItems = useMemo(() => {
    const query = commandQuery.trim().toLowerCase();
    if (!query) {
      return commandItems;
    }

    return commandItems.filter((command) => {
      return [command.title, command.hint, command.group].join(' ').toLowerCase().includes(query);
    });
  }, [commandItems, commandQuery]);

  async function refreshData({ silent = false } = {}) {
    // Background polls must not flash the refresh spinner or clear an error the user is reading.
    if (!silent) {
      setRefreshing(true);
      setError(null);
    }
    try {
      const reminderFilters = selectedReminderFilters();
      const notificationFilters = selectedNotificationFilters();
      const hasActiveReminderFilters = hasReminderFilters(reminderFilters);
      const allRemindersRequest = listReminders();
      const visibleRemindersRequest = hasActiveReminderFilters
        ? listReminders(reminderFilters)
        : allRemindersRequest;
      const allNotificationsRequest = listNotifications();
      const visibleNotificationsRequest = hasNotificationFilters(notificationFilters)
        ? listNotifications(notificationFilters)
        : allNotificationsRequest;
      const [nextReminders, nextVisibleReminders, nextNotifications, nextVisibleNotifications] = await Promise.all([
        allRemindersRequest,
        visibleRemindersRequest,
        allNotificationsRequest,
        visibleNotificationsRequest
      ]);
      const sortedReminders = sortRemindersNewestFirst(nextReminders);
      setReminders(sortedReminders);
      setVisibleReminders(
        hasActiveReminderFilters ? sortRemindersNewestFirst(nextVisibleReminders) : sortedReminders
      );
      setNotifications(nextNotifications);
      setVisibleNotifications(nextVisibleNotifications);
    } catch (err) {
      if (isUnauthorized(err)) {
        endSession(formatError(err, t));
      } else if (!silent) {
        setError(formatError(err, t));
      }
    } finally {
      if (!silent) {
        setRefreshing(false);
      }
    }
  }

  async function refreshVisibleReminders() {
    setRefreshing(true);
    setError(null);
    try {
      const nextReminders = await listReminders(selectedReminderFilters());
      setVisibleReminders(sortRemindersNewestFirst(nextReminders));
    } catch (err) {
      handleRequestError(err);
    } finally {
      setRefreshing(false);
    }
  }

  async function refreshVisibleNotifications() {
    setRefreshing(true);
    setError(null);
    try {
      const nextNotifications = await listNotifications(selectedNotificationFilters());
      setVisibleNotifications(nextNotifications);
    } catch (err) {
      handleRequestError(err);
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
        : await register({
          email,
          password,
          firstName: registrationProfile.firstName.trim(),
          lastName: registrationProfile.lastName.trim(),
          phoneNumber: registrationProfile.phoneNumber.trim(),
          preferredLanguage: language
        });
      setUser(response.user);
      setPassword('');
      setRegistrationProfile(emptyRegistrationProfileForm());
      await refreshData();
    } catch (err) {
      setError(formatError(err, t));
    } finally {
      setLoading(false);
    }
  }

  async function submitReminder(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
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
        await updateReminder(editingId, payload);
      } else {
        await createReminder(payload);
      }
      setForm(emptyReminderForm(user));
      setEditingId(null);
      await refreshData();
    } catch (err) {
      handleRequestError(err);
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const currentPassword = passwordChangeForm.currentPassword;
    const newPassword = passwordChangeForm.newPassword;
    const confirmPassword = passwordChangeForm.confirmPassword;

    if (newPassword !== confirmPassword) {
      setPasswordChangeStatus({ tone: 'error', message: t('error.passwordMismatch') });
      return;
    }

    setPasswordSubmitting(true);
    setPasswordChangeStatus(null);
    setError(null);

    try {
      const response = await changePassword({ currentPassword, newPassword });
      setUser(response.user);
      setPasswordChangeForm(emptyPasswordChangeForm());
      setPasswordChangeStatus({ tone: 'success', message: t('status.passwordChanged') });
    } catch (err) {
      setPasswordChangeStatus({ tone: 'error', message: formatError(err, t) });
    } finally {
      setPasswordSubmitting(false);
    }
  }

  async function submitProfileUpdate(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProfileSubmitting(true);
    setProfileStatus(null);
    setError(null);

    try {
      const response = await updateProfile({
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        preferredLanguage: profileForm.preferredLanguage
      });
      setUser(response.user);
      setLanguage(response.user.preferredLanguage);
      setProfileStatus({ tone: 'success', message: t('status.profileUpdated') });
    } catch (err) {
      setProfileStatus({ tone: 'error', message: formatError(err, t) });
    } finally {
      setProfileSubmitting(false);
    }
  }

  async function removeReminder(id: string) {
    setPendingDeleteId(null);
    setError(null);
    try {
      await deleteReminder(id);
      if (editingId === id) {
        setEditingId(null);
        setForm(emptyReminderForm(user));
      }
      await refreshData();
    } catch (err) {
      handleRequestError(err);
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
    // The Gateway clears the HttpOnly cookie; local state is reset even if that call fails.
    logout().catch(() => undefined);
    endSession(null);
  }

  function handleRequestError(err: unknown) {
    if (isUnauthorized(err)) {
      endSession(formatError(err, t));
      return;
    }
    setError(formatError(err, t));
  }

  function endSession(message: string | null) {
    setError(message);
    setUser(null);
    setReminders([]);
    setVisibleReminders([]);
    setNotifications([]);
    setVisibleNotifications([]);
    setEditingId(null);
    setForm(emptyReminderForm());
    setPasswordChangeForm(emptyPasswordChangeForm());
    setPasswordChangeStatus(null);
  }

  function toggleTheme() {
    setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark');
  }

  function changeProfileLanguage(nextLanguage: LanguageCode) {
    setProfileForm((currentForm) => ({ ...currentForm, preferredLanguage: nextLanguage }));
    setLanguage(nextLanguage);
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

  function focusReminderForm() {
    openDashboardView('reminders');
    window.setTimeout(() => document.getElementById('reminder-title-input')?.focus(), 0);
  }

  if (!isAuthenticated) {
    return (
      <main className="auth-page">
        <section className="auth-showcase" aria-hidden="true">
          <div className="brand">
            <span className="brand-mark"><Bell size={20} /></span>
            <span>{t('app.name')}</span>
          </div>
          <div className="auth-route">
            <p>{t('auth.tagline')}</p>
            <ol>
              {['pipeline.created', 'pipeline.scheduled', 'pipeline.queued', 'pipeline.delivery'].map((key) => (
                <li key={key}><span className="route-stop" />{t(key)}</li>
              ))}
            </ol>
          </div>
          <div className="auth-lines">
            {CHANNELS.map((channel) => channelBadge(channel))}
          </div>
        </section>

        <section className="auth-panel" aria-labelledby="auth-title">
          <div className="auth-heading">
            <div>
              <h1 id="auth-title">{t('app.name')}</h1>
              <p>{t('auth.subtitle')}</p>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} t={t} />
          </div>

          <div
            className="segmented auth-tabs"
            role="tablist"
            aria-label={t('aria.authenticationMode')}
            onKeyDown={(event) => {
              if (event.key === 'ArrowLeft' || event.key === 'ArrowRight') {
                const next = authMode === 'login' ? 'register' : 'login';
                setAuthMode(next);
                document.getElementById(`auth-tab-${next}`)?.focus();
              }
            }}
          >
            {(['login', 'register'] as AuthMode[]).map((mode) => (
              <button
                type="button"
                key={mode}
                id={`auth-tab-${mode}`}
                role="tab"
                aria-selected={authMode === mode}
                aria-controls="auth-form"
                tabIndex={authMode === mode ? 0 : -1}
                className={authMode === mode ? 'active' : ''}
                onClick={() => setAuthMode(mode)}
              >
                {t(`auth.${mode}`)}
              </button>
            ))}
          </div>

          <form className="form" id="auth-form" role="tabpanel" aria-labelledby={`auth-tab-${authMode}`} onSubmit={submitAuth}>
            {authMode === 'register' ? (
              <div className="form-row">
                <label>
                  {t('auth.firstName')}
                  <input
                    type="text"
                    value={registrationProfile.firstName}
                    onChange={(event) => setRegistrationProfile({ ...registrationProfile, firstName: event.target.value })}
                    placeholder="Haci"
                    autoComplete="given-name"
                    maxLength={80}
                    required
                  />
                </label>
                <label>
                  {t('auth.lastName')}
                  <input
                    type="text"
                    value={registrationProfile.lastName}
                    onChange={(event) => setRegistrationProfile({ ...registrationProfile, lastName: event.target.value })}
                    placeholder="Simsek"
                    autoComplete="family-name"
                    maxLength={80}
                    required
                  />
                </label>
              </div>
            ) : null}
            <label>
              {t('auth.email')}
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'auth-error' : undefined}
                placeholder="user@example.com"
                autoComplete="email"
                required
              />
            </label>
            {authMode === 'register' ? (
              <label>
                {t('auth.phoneNumber')}
                <input
                  type="tel"
                  value={registrationProfile.phoneNumber}
                  onChange={(event) => setRegistrationProfile({ ...registrationProfile, phoneNumber: event.target.value })}
                  placeholder="+90 555 111 2233"
                  autoComplete="tel"
                  maxLength={32}
                  required
                />
              </label>
            ) : null}
            <label>
              {t('auth.password')}
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                aria-invalid={error ? true : undefined}
                aria-describedby={error ? 'auth-error' : undefined}
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            {error ? <p id="auth-error" className="form-message error" role="alert">{error}</p> : null}
            <button type="submit" className="button primary wide" disabled={loading}>
              {loading ? <Loader2 className="spin" size={16} aria-hidden="true" /> : <ShieldCheck size={16} aria-hidden="true" />}
              {authMode === 'login' ? t('auth.signIn') : t('auth.createAccount')}
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
  const navItems: { view: DashboardView; icon: ReactNode }[] = [
    { view: 'overview', icon: <LayoutDashboard size={18} aria-hidden="true" /> },
    { view: 'reminders', icon: <CalendarClock size={18} aria-hidden="true" /> },
    { view: 'history', icon: <History size={18} aria-hidden="true" /> },
    { view: 'profile', icon: <User size={18} aria-hidden="true" /> }
  ];

  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(event) => {
          // Hash routes drive the views, so move focus without touching location.hash.
          event.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        {t('actions.skipToContent')}
      </a>
      <aside className="rail" aria-label={t('aria.primaryNavigation')}>
        <div className="brand">
          <span className="brand-mark"><Bell size={18} aria-hidden="true" /></span>
          <span>{t('app.name')}</span>
        </div>
        <nav>
          {navItems.map(({ view, icon }) => (
            <a
              key={view}
              href={DASHBOARD_ROUTES[view]}
              aria-current={activeView === view ? 'page' : undefined}
              onClick={(event) => {
                event.preventDefault();
                openDashboardView(view);
              }}
            >
              {icon}{t(`nav.${view}`)}
            </a>
          ))}
        </nav>
        <div className="rail-footer">
          <button type="button" className="rail-action" onClick={() => setCommandPaletteOpen(true)} title={t('actions.openCommandPalette')}>
            <Search size={17} aria-hidden="true" />
            <span>{t('actions.command')}</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} t={t} />
          <button type="button" className="rail-action" onClick={signOut} title={t('actions.signOut')}>
            <LogOut size={17} aria-hidden="true" />
            <span>{t('actions.signOut')}</span>
          </button>
          <div className="rail-account">
            <span className="avatar small" aria-hidden="true">{profileInitial(authenticatedUser)}</span>
            <span>{authenticatedUser.email}</span>
          </div>
        </div>
      </aside>

      <main className="workspace" id="main-content" tabIndex={-1}>
        <header className="page-head">
          <h1>{t(`heading.${activeView}.title`)}</h1>
          <div className="page-actions">
            {activeView === 'reminders' || activeView === 'overview' ? (
              <button type="button" className="button" onClick={focusReminderForm}>
                <Plus size={16} aria-hidden="true" />{t('command.createReminder.title')}
              </button>
            ) : null}
            <button type="button" className="button" onClick={() => refreshData()} disabled={refreshing} title={t('actions.refreshData')}>
              <RefreshCw className={refreshing ? 'spin' : ''} size={16} aria-hidden="true" />
              {t('actions.refresh')}
            </button>
          </div>
        </header>

        {error ? <div className="banner error" role="alert">{error}</div> : null}

        {activeView === 'overview' ? (
          <div className="overview-grid" aria-label={t('aria.developerCockpit')}>
            <div className="overview-column">
              <DeparturesBoard
                reminders={reminders}
                language={language}
                onInspect={setInspectorTarget}
                onCreate={focusReminderForm}
                t={t}
              />
              <ServiceTopology metrics={metrics} t={t} />
            </div>
            <div className="overview-column">
              <LineStatus notifications={notifications} metrics={metrics} t={t} />
              <LiveEventConsole events={eventStream} onInspect={setInspectorTarget} t={t} />
            </div>
          </div>
        ) : null}

        {activeView === 'reminders' ? (
          <div className="reminders-grid">
            <section className="panel compose" aria-labelledby="compose-title">
              <header className="panel-head">
                <h2 id="compose-title">{editingId ? t('reminder.editTitle') : t('reminder.newTitle')}</h2>
              </header>
              <form className="form" onSubmit={submitReminder}>
                <label>
                  {t('reminder.title')}
                  <input
                    id="reminder-title-input"
                    value={form.title}
                    onChange={(event) => setForm({ ...form, title: event.target.value })}
                    maxLength={140}
                    required
                  />
                </label>
                <label>
                  {t('reminder.scheduledFor')}
                  <input
                    type="datetime-local"
                    value={form.scheduledFor}
                    onChange={(event) => setForm({ ...form, scheduledFor: event.target.value })}
                    required
                  />
                </label>
                <label>
                  <span>{t('reminder.message')} <span className="optional">({t('form.optional')})</span></span>
                  <textarea
                    value={form.message}
                    onChange={(event) => setForm({ ...form, message: event.target.value })}
                    maxLength={1000}
                    rows={3}
                  />
                </label>
                <div className="field" role="group" aria-labelledby="channel-control-label">
                  <span className="field-label" id="channel-control-label">{t('reminder.channel')}</span>
                  <div className="segmented channels">
                    {CHANNELS.map((channel) => (
                      <button
                        type="button"
                        key={channel}
                        className={`line-${channel.toLowerCase()} ${form.channel === channel ? 'active' : ''}`}
                        aria-pressed={form.channel === channel}
                        onClick={() => setForm((currentForm) => reminderFormWithChannel(currentForm, channel, user))}
                      >
                        {channelIcon(channel)}
                        <span>{channel}</span>
                      </button>
                    ))}
                  </div>
                </div>
                <label>
                  {t('reminder.recipient')}
                  <input
                    value={form.recipient}
                    onChange={(event) => setForm({ ...form, recipient: event.target.value })}
                    placeholder={recipientPlaceholder(form.channel)}
                    maxLength={320}
                    required
                  />
                </label>
                <div className="form-actions">
                  {editingId ? (
                    <button
                      type="button"
                      className="button"
                      onClick={() => {
                        setEditingId(null);
                        setForm(emptyReminderForm(user));
                      }}
                    >
                      {t('actions.cancelEdit')}
                    </button>
                  ) : null}
                  <button type="submit" className="button primary" disabled={loading}>
                    {loading
                      ? <Loader2 className="spin" size={16} aria-hidden="true" />
                      : editingId ? <Save size={16} aria-hidden="true" /> : <Plus size={16} aria-hidden="true" />}
                    {editingId ? t('actions.updateReminder') : t('actions.addReminder')}
                  </button>
                </div>
              </form>
            </section>

            <section className="panel timetable" id="reminders" aria-labelledby="reminders-title">
              <header className="panel-head">
                <h2 id="reminders-title">{t('reminder.listTitle')}</h2>
                <span className="count">{visibleReminders.length} / {reminders.length}</span>
              </header>

              <div className="toolbar" role="group" aria-label={t('reminder.filters')}>
                <FilterGroup
                  label={t('table.status')}
                  options={['ALL', ...REMINDER_STATUSES] as ReminderStatusFilter[]}
                  value={reminderStatusFilter}
                  render={(status) => statusFilterLabel(status, t)}
                  onChange={setReminderStatusFilter}
                />
                <FilterGroup
                  label={t('reminder.channel')}
                  options={['ALL', ...CHANNELS] as ReminderChannelFilter[]}
                  value={reminderChannelFilter}
                  render={(channel) => channel === 'ALL' ? t('filters.all') : channel}
                  onChange={setReminderChannelFilter}
                />
              </div>

              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th scope="col">{t('table.scheduled')}</th>
                      <th scope="col">{t('table.title')}</th>
                      <th scope="col">{t('table.channel')}</th>
                      <th scope="col">{t('table.pipeline')}</th>
                      <th scope="col">{t('table.status')}</th>
                      <th scope="col"><span className="visually-hidden">{t('table.actions')}</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {visibleReminders.map((reminder) => (
                      <tr key={reminder.id} className={editingId === reminder.id ? 'editing' : undefined}>
                        <td className="cell-time">
                          <strong>{formatClock(reminder.scheduledFor)}</strong>
                          <span>{formatDay(reminder.scheduledFor)}</span>
                        </td>
                        <td className="cell-title">
                          <strong>{reminder.title}</strong>
                          <span>{reminder.recipient}</span>
                        </td>
                        <td>{channelBadge(reminder.channel)}</td>
                        <td>
                          <PipelineTimeline status={reminder.status} channel={reminder.channel} ariaLabel={t('aria.deliveryPipeline')} t={t} />
                        </td>
                        <td>{statusBadge(reminder.status, t)}</td>
                        <td className="row-actions">
                          {pendingDeleteId === reminder.id ? (
                            <span className="confirm-delete">
                              <button type="button" className="button small danger" autoFocus onClick={() => removeReminder(reminder.id)}>
                                {t('actions.confirmDelete')}
                              </button>
                              <button type="button" className="button small" onClick={() => setPendingDeleteId(null)}>
                                {t('actions.keep')}
                              </button>
                            </span>
                          ) : (
                            <>
                              <button type="button" className="icon-button" onClick={() => setInspectorTarget({ kind: 'reminder', item: reminder })} title={t('actions.inspectReminder')} aria-label={t('actions.inspectReminder')}>
                                <Code2 size={16} aria-hidden="true" />
                              </button>
                              <button type="button" className="icon-button" onClick={() => startEditing(reminder)} title={t('actions.editReminder')} aria-label={t('actions.editReminder')}>
                                <Edit3 size={16} aria-hidden="true" />
                              </button>
                              <button type="button" className="icon-button danger" onClick={() => setPendingDeleteId(reminder.id)} title={t('actions.deleteReminder')} aria-label={t('actions.deleteReminder')}>
                                <Trash2 size={16} aria-hidden="true" />
                              </button>
                            </>
                          )}
                        </td>
                      </tr>
                    ))}
                    {reminders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-state">{t('reminder.noItems')}</td>
                      </tr>
                    ) : null}
                    {reminders.length > 0 && visibleReminders.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="empty-state">{t('reminder.noMatches')}</td>
                      </tr>
                    ) : null}
                  </tbody>
                </table>
              </div>
            </section>
          </div>
        ) : null}

        {activeView === 'history' ? (
          <section className="panel" id="history" aria-labelledby="notifications-title">
            <header className="panel-head">
              <h2 id="notifications-title">{t('history.listTitle')}</h2>
              <span className="count">{visibleNotifications.length} / {notifications.length}</span>
            </header>

            <div className="toolbar" role="group" aria-label={t('history.filters')}>
              <FilterGroup
                label={t('table.status')}
                options={['ALL', ...DELIVERY_STATUSES] as NotificationStatusFilter[]}
                value={notificationStatusFilter}
                render={(status) => statusFilterLabel(status, t)}
                onChange={setNotificationStatusFilter}
              />
              <FilterGroup
                label={t('reminder.channel')}
                options={['ALL', ...CHANNELS] as NotificationChannelFilter[]}
                value={notificationChannelFilter}
                render={(channel) => channel === 'ALL' ? t('filters.all') : channel}
                onChange={setNotificationChannelFilter}
              />
            </div>

            <ol className="trips">
              {visibleNotifications.map((notification) => (
                <li className={`trip ${notification.status.toLowerCase()}`} key={notification.id}>
                  <div className="cell-time">
                    <strong>{formatClock(notification.createdAt)}</strong>
                    <span>{formatDay(notification.createdAt)}</span>
                  </div>
                  <div className="trip-body">
                    <div className="trip-title">
                      <strong>{notification.subject}</strong>
                      {statusBadge(notification.status, t)}
                    </div>
                    <p>{notification.message}</p>
                    <div className="trip-meta">
                      <span>{notification.recipient}</span>
                      <span>{t('history.attempts')}: {notification.attemptCount}</span>
                      {notification.lastAttemptAt ? <span>{t('history.lastAttempt')}: {formatDate(notification.lastAttemptAt)}</span> : null}
                    </div>
                    {notification.failureReason ? <p className="trip-reason">{notification.failureReason}</p> : null}
                  </div>
                  <div className="trip-side">
                    {channelBadge(notification.channel)}
                    <PipelineTimeline deliveryStatus={notification.status} channel={notification.channel} ariaLabel={t('aria.deliveryPipeline')} t={t} />
                    <button type="button" className="button small" onClick={() => setInspectorTarget({ kind: 'notification', item: notification })}>
                      <Code2 size={14} aria-hidden="true" />{t('actions.inspectPayload')}
                    </button>
                  </div>
                </li>
              ))}
            </ol>
            {notifications.length === 0 ? <p className="empty-state">{t('history.noItems')}</p> : null}
            {notifications.length > 0 && visibleNotifications.length === 0 ? (
              <p className="empty-state">{t('history.noMatches')}</p>
            ) : null}
          </section>
        ) : null}

        {activeView === 'profile' ? (
          <ProfileSettingsPage
            user={authenticatedUser}
            profileForm={profileForm}
            profileStatus={profileStatus}
            profileSubmitting={profileSubmitting}
            onProfileChange={setProfileForm}
            onLanguageChange={changeProfileLanguage}
            onProfileSubmit={submitProfileUpdate}
            passwordForm={passwordChangeForm}
            passwordStatus={passwordChangeStatus}
            passwordSubmitting={passwordSubmitting}
            onPasswordChange={setPasswordChangeForm}
            onPasswordSubmit={submitPasswordChange}
            t={t}
          />
        ) : null}
      </main>

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
          t={t}
        />
      ) : null}

      {inspectorTarget ? (
        <InspectorDrawer target={inspectorTarget} onClose={() => setInspectorTarget(null)} t={t} />
      ) : null}
    </div>
  );
}

function FilterGroup<T extends string>({
  label,
  options,
  value,
  render,
  onChange
}: {
  label: string;
  options: T[];
  value: T;
  render: (option: T) => string;
  onChange: (option: T) => void;
}) {
  return (
    <div className="filter-group">
      <span className="field-label">{label}</span>
      <div className="chips">
        {options.map((option) => (
          <button
            type="button"
            key={option}
            className={value === option ? 'active' : ''}
            aria-pressed={value === option}
            onClick={() => onChange(option)}
          >
            {render(option)}
          </button>
        ))}
      </div>
    </div>
  );
}
