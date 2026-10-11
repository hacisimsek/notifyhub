import { FormEvent, useEffect, useMemo, useState } from 'react';
import {
  Bell,
  CalendarClock,
  CheckCircle2,
  Clock3,
  Code2,
  Edit3,
  Filter,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Plus,
  RefreshCw,
  Save,
  Send,
  ShieldCheck,
  Terminal,
  Trash2,
  User,
  XCircle
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
  InspectorDrawer,
  LiveEventConsole,
  Metric,
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
  formatDate,
  formatError,
  hasNotificationFilters,
  hasReminderFilters,
  initialLanguage,
  initialTheme,
  profileFormFromUser,
  recipientPlaceholder,
  reminderFormWithChannel,
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
      run: () => {
        openDashboardView('reminders');
        window.setTimeout(() => document.getElementById('reminder-title-input')?.focus(), 0);
      }
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
                <h1 id="auth-title">{t('app.name')}</h1>
                <p>{t('auth.subtitle')}</p>
              </div>
            </div>
            <ThemeToggle theme={theme} onToggle={toggleTheme} t={t} />
          </div>

          <div className="auth-tabs" role="tablist" aria-label={t('aria.authenticationMode')}>
            <button
              type="button"
              className={authMode === 'login' ? 'active' : ''}
              onClick={() => setAuthMode('login')}
            >
              {t('auth.login')}
            </button>
            <button
              type="button"
              className={authMode === 'register' ? 'active' : ''}
              onClick={() => setAuthMode('register')}
            >
              {t('auth.register')}
            </button>
          </div>

          <form className="stack-form" onSubmit={submitAuth}>
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
                placeholder="secret123"
                autoComplete={authMode === 'login' ? 'current-password' : 'new-password'}
                minLength={8}
                maxLength={128}
                required
              />
            </label>
            {error ? <p className="form-error">{error}</p> : null}
            <button type="submit" className="primary-action" disabled={loading}>
              {loading ? <Loader2 className="spin" size={18} aria-hidden="true" /> : <ShieldCheck size={18} aria-hidden="true" />}
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
  const heading = activeView === 'history'
    ? { eyebrow: t('heading.history.eyebrow'), title: t('heading.history.title') }
    : activeView === 'profile'
      ? { eyebrow: t('heading.profile.eyebrow'), title: t('heading.profile.title') }
      : activeView === 'reminders'
        ? { eyebrow: t('heading.reminders.eyebrow'), title: t('heading.reminders.title') }
        : { eyebrow: t('heading.overview.eyebrow'), title: t('heading.overview.title') };

  return (
    <main className="app-shell">
      <aside className="side-nav" aria-label={t('aria.primaryNavigation')}>
        <div className="brand-row compact">
          <div className="brand-mark">
            <Bell size={20} aria-hidden="true" />
          </div>
          <span>{t('app.name')}</span>
        </div>
        <div className="nav-console" aria-hidden="true">
          <span>$ notifyhub</span>
          <strong>watch --live</strong>
        </div>
        <nav>
          <a
            href={DASHBOARD_ROUTES.overview}
            aria-current={activeView === 'overview' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              openDashboardView('overview');
            }}
          >
            <LayoutDashboard size={18} aria-hidden="true" />{t('nav.overview')}
          </a>
          <a
            href={DASHBOARD_ROUTES.reminders}
            aria-current={activeView === 'reminders' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              openDashboardView('reminders');
            }}
          >
            <CalendarClock size={18} aria-hidden="true" />{t('nav.reminders')}
          </a>
          <a
            href={DASHBOARD_ROUTES.history}
            aria-current={activeView === 'history' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              openDashboardView('history');
            }}
          >
            <History size={18} aria-hidden="true" />{t('nav.history')}
          </a>
          <a
            href={DASHBOARD_ROUTES.profile}
            aria-current={activeView === 'profile' ? 'page' : undefined}
            onClick={(event) => {
              event.preventDefault();
              openDashboardView('profile');
            }}
          >
            <User size={18} aria-hidden="true" />{t('nav.profile')}
          </a>
        </nav>
        <div className="side-actions">
          <span className="account-chip">{authenticatedUser.email}</span>
          <button type="button" className="icon-action command-trigger" onClick={() => setCommandPaletteOpen(true)} title={t('actions.openCommandPalette')}>
            <Terminal size={18} aria-hidden="true" />
            <span>{t('actions.command')}</span>
            <kbd>⌘K</kbd>
          </button>
          <ThemeToggle theme={theme} onToggle={toggleTheme} t={t} />
          <button type="button" className="icon-action" onClick={() => refreshData()} disabled={refreshing} title={t('actions.refreshData')}>
            <RefreshCw className={refreshing ? 'spin' : ''} size={18} aria-hidden="true" />
            <span>{t('actions.refresh')}</span>
          </button>
          <button type="button" className="icon-action" onClick={signOut} title={t('actions.signOut')}>
            <LogOut size={18} aria-hidden="true" />
            <span>{t('actions.signOut')}</span>
          </button>
        </div>
      </aside>

      <section className="workspace">
        <header className="top-bar">
          <div>
            <p className="eyebrow">{heading.eyebrow}</p>
            <h1>{heading.title}</h1>
          </div>
        </header>

        {error ? <div className="alert-error">{error}</div> : null}

        {activeView === 'overview' ? (
          <>
            <section className="metric-grid" aria-label={t('aria.deliveryMetrics')}>
              <Metric label={t('metrics.scheduled')} value={metrics.scheduled} icon={<CalendarClock size={20} />} tone="blue" />
              <Metric label={t('metrics.triggered')} value={metrics.triggered} icon={<Send size={20} />} tone="purple" />
              <Metric label={t('metrics.sent')} value={metrics.sent} icon={<CheckCircle2 size={20} />} tone="green" />
              <Metric label={t('metrics.failed')} value={metrics.failed} icon={<XCircle size={20} />} tone="red" />
              <Metric label={t('metrics.retrying')} value={metrics.retrying} icon={<RefreshCw size={20} />} tone="amber" />
              <Metric label={t('metrics.attempts')} value={metrics.totalAttempts} icon={<Clock3 size={20} />} tone="slate" />
            </section>

            <section className="developer-grid" aria-label={t('aria.developerCockpit')}>
              <ServiceTopology metrics={metrics} t={t} />
              <LiveEventConsole events={eventStream} onInspect={setInspectorTarget} t={t} />
            </section>
          </>
        ) : null}

        <section className="content-grid">
          {activeView === 'reminders' ? (
          <section className="panel" id="reminders" aria-labelledby="reminders-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t('heading.reminders.eyebrow')}</p>
                <h2 id="reminders-title">{t('heading.reminders.title')}</h2>
              </div>
              <div className="heading-actions">
                <span className="history-count">{visibleReminders.length} / {reminders.length}</span>
              </div>
            </div>

            <form className="reminder-form" onSubmit={submitReminder}>
              <div className="form-row">
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
              </div>

              <label>
                {t('reminder.message')}
                <textarea
                  value={form.message}
                  onChange={(event) => setForm({ ...form, message: event.target.value })}
                  maxLength={1000}
                  rows={3}
                />
              </label>

              <div className="form-row">
                <div className="segmented-control" role="group" aria-labelledby="channel-control-label">
                  <span className="control-label" id="channel-control-label">{t('reminder.channel')}</span>
                  <div className="segmented-options">
                    {CHANNELS.map((channel) => (
                      <button
                        type="button"
                        key={channel}
                        className={form.channel === channel ? 'active' : ''}
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
              </div>

              <div className="form-actions">
                {editingId ? (
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setEditingId(null);
                      setForm(emptyReminderForm(user));
                    }}
                  >
                    {t('actions.cancelEdit')}
                  </button>
                ) : null}
                <button type="submit" className="primary-action" disabled={loading}>
                  {editingId ? <Save size={18} aria-hidden="true" /> : <Plus size={18} aria-hidden="true" />}
                  {editingId ? t('actions.updateReminder') : t('actions.addReminder')}
                </button>
              </div>
            </form>

            <div className="notification-toolbar" aria-label={t('reminder.filters')}>
              <div className="filter-group">
                <span><Filter size={15} aria-hidden="true" />{t('table.status')}</span>
                <div className="filter-buttons">
                  {(['ALL', ...REMINDER_STATUSES] as ReminderStatusFilter[]).map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={reminderStatusFilter === status ? 'active' : ''}
                      onClick={() => setReminderStatusFilter(status)}
                    >
                      {statusFilterLabel(status, t)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <span>{channelIcon('EMAIL')}{t('reminder.channel')}</span>
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
                    <th>{t('table.title')}</th>
                    <th>{t('table.channel')}</th>
                    <th>{t('table.scheduled')}</th>
                    <th>{t('table.pipeline')}</th>
                    <th>{t('table.status')}</th>
                    <th aria-label={t('table.actions')} />
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
                      <td><PipelineTimeline status={reminder.status} ariaLabel={t('aria.deliveryPipeline')} t={t} /></td>
                      <td>{statusBadge(reminder.status, t)}</td>
                      <td className="row-actions">
                        <button type="button" onClick={() => setInspectorTarget({ kind: 'reminder', item: reminder })} title={t('actions.inspectReminder')}>
                          <Code2 size={16} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => startEditing(reminder)} title={t('actions.editReminder')}>
                          <Edit3 size={16} aria-hidden="true" />
                        </button>
                        <button type="button" onClick={() => removeReminder(reminder.id)} title={t('actions.deleteReminder')}>
                          <Trash2 size={16} aria-hidden="true" />
                        </button>
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
          ) : null}

          {activeView === 'history' ? (
          <section className="panel" id="history" aria-labelledby="notifications-title">
            <div className="panel-heading">
              <div>
                <p className="eyebrow">{t('heading.history.eyebrow')}</p>
                <h2 id="notifications-title">{t('nav.history')}</h2>
              </div>
              <span className="history-count">{visibleNotifications.length} / {notifications.length}</span>
            </div>

            <div className="notification-toolbar" aria-label={t('history.filters')}>
              <div className="filter-group">
                <span><Filter size={15} aria-hidden="true" />{t('table.status')}</span>
                <div className="filter-buttons">
                  {(['ALL', ...DELIVERY_STATUSES] as NotificationStatusFilter[]).map((status) => (
                    <button
                      type="button"
                      key={status}
                      className={notificationStatusFilter === status ? 'active' : ''}
                      onClick={() => setNotificationStatusFilter(status)}
                    >
                      {statusFilterLabel(status, t)}
                    </button>
                  ))}
                </div>
              </div>
              <div className="filter-group">
                <span>{channelIcon('EMAIL')}{t('reminder.channel')}</span>
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
                      {statusBadge(notification.status, t)}
                    </div>
                    <PipelineTimeline deliveryStatus={notification.status} ariaLabel={t('aria.deliveryPipeline')} t={t} />
                    <p>{notification.message}</p>
                    <div className="notification-meta">
                      <span>
                        {notification.recipient} · {formatDate(notification.createdAt)} · {t('history.attempts')}: {notification.attemptCount}
                      </span>
                      {notification.lastAttemptAt ? <span>{t('history.lastAttempt')}: {formatDate(notification.lastAttemptAt)}</span> : null}
                      {notification.failureReason ? <span>{notification.failureReason}</span> : null}
                    </div>
                    <button type="button" className="inline-inspect" onClick={() => setInspectorTarget({ kind: 'notification', item: notification })}>
                      {t('actions.inspectPayload')}
                    </button>
                  </div>
                </article>
              ))}
              {notifications.length === 0 ? <div className="empty-state">{t('history.noItems')}</div> : null}
              {notifications.length > 0 && visibleNotifications.length === 0 ? (
                <div className="empty-state">{t('history.noMatches')}</div>
              ) : null}
            </div>
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
          t={t}
        />
      ) : null}

      {inspectorTarget ? (
        <InspectorDrawer target={inspectorTarget} onClose={() => setInspectorTarget(null)} t={t} />
      ) : null}

    </main>
  );
}
