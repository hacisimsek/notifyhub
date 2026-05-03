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
  KeyRound,
  LayoutDashboard,
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
  User,
  XCircle
} from 'lucide-react';
import {
  AuthResponse,
  Channel,
  NotificationLog,
  Reminder,
  ReminderPayload,
  UserSummary,
  changePassword,
  createReminder,
  currentUser,
  deleteReminder,
  getLanguageMessages,
  listNotifications,
  listReminders,
  login,
  register,
  updateProfile,
  updateReminder
} from './api';
import type { DeliveryStatus, LanguageCode, NotificationFilters, ReminderFilters, ReminderStatus } from './api';

type AuthMode = 'login' | 'register';
type ReminderStatusFilter = 'ALL' | ReminderStatus;
type ReminderChannelFilter = 'ALL' | Channel;
type NotificationStatusFilter = 'ALL' | DeliveryStatus;
type NotificationChannelFilter = 'ALL' | Channel;
type ThemeMode = 'light' | 'dark';
type DashboardView = 'overview' | 'reminders' | 'history' | 'profile';
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
type PasswordChangeForm = {
  currentPassword: string;
  newPassword: string;
  confirmPassword: string;
};
type RegistrationProfileForm = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  preferredLanguage: LanguageCode;
};
type ProfileForm = RegistrationProfileForm;
type FormStatus = {
  tone: 'error' | 'success';
  message: string;
};

type ReminderForm = {
  title: string;
  message: string;
  scheduledFor: string;
  channel: Channel;
  recipient: string;
};

const TOKEN_KEY = 'notifyhub.dashboard.token';
const THEME_KEY = 'notifyhub.dashboard.theme';
const LANGUAGE_KEY = 'notifyhub.dashboard.language';
const CHANNELS: Channel[] = ['EMAIL', 'SMS', 'PUSH'];
const REMINDER_STATUSES: ReminderStatus[] = ['SCHEDULED', 'TRIGGERED', 'CANCELLED'];
const DELIVERY_STATUSES: DeliveryStatus[] = ['PENDING', 'SENT', 'FAILED', 'RETRYING'];
const DASHBOARD_ROUTES: Record<DashboardView, string> = {
  overview: '#overview',
  reminders: '#reminders',
  history: '#history',
  profile: '#profile'
};

const DEFAULT_MESSAGES: Record<string, string> = {
  'app.name': 'NotifyHub',
  'auth.subtitle': 'Reminder operations dashboard',
  'auth.login': 'Login',
  'auth.register': 'Register',
  'auth.email': 'Email',
  'auth.password': 'Password',
  'auth.firstName': 'First name',
  'auth.lastName': 'Last name',
  'auth.phoneNumber': 'Phone number',
  'auth.signIn': 'Sign in',
  'auth.createAccount': 'Create account',
  'nav.overview': 'Overview',
  'nav.reminders': 'Reminders',
  'nav.history': 'History',
  'nav.profile': 'Profile',
  'actions.command': 'Command',
  'actions.refresh': 'Refresh',
  'actions.signOut': 'Sign out',
  'actions.saveProfile': 'Save profile',
  'actions.changePassword': 'Change password',
  'actions.addReminder': 'Add reminder',
  'actions.updateReminder': 'Update reminder',
  'actions.cancelEdit': 'Cancel edit',
  'actions.inspectPayload': 'Inspect payload',
  'actions.openCommandPalette': 'Open command palette',
  'actions.refreshData': 'Refresh data',
  'actions.inspectReminder': 'Inspect reminder payload',
  'actions.editReminder': 'Edit reminder',
  'actions.deleteReminder': 'Delete reminder',
  'actions.closeInspector': 'Close inspector',
  'theme.dark': 'Dark',
  'theme.light': 'Light',
  'theme.switchDark': 'Switch to dark theme',
  'theme.switchLight': 'Switch to light theme',
  'heading.overview.eyebrow': 'Runtime overview',
  'heading.overview.title': 'Operations overview',
  'heading.reminders.eyebrow': 'Create and manage',
  'heading.reminders.title': 'Reminders',
  'heading.history.eyebrow': 'Delivery log',
  'heading.history.title': 'Notification history',
  'heading.profile.eyebrow': 'Account settings',
  'heading.profile.title': 'Profile',
  'metrics.scheduled': 'Scheduled',
  'metrics.triggered': 'Triggered',
  'metrics.sent': 'Sent',
  'metrics.failed': 'Failed',
  'metrics.retrying': 'Retrying',
  'metrics.attempts': 'Attempts',
  'overview.topology.eyebrow': 'Runtime map',
  'overview.topology.title': 'Service topology',
  'overview.console.eyebrow': 'Event stream',
  'overview.console.title': 'Live console',
  'profile.userInfo': 'User info',
  'profile.security': 'Account security',
  'profile.password': 'Password',
  'profile.userId': 'User ID',
  'profile.role': 'Role',
  'profile.created': 'Created',
  'profile.activeSession': 'Active session',
  'profile.language': 'Language',
  'profile.languageEnglish': 'English',
  'profile.languageTurkish': 'Turkish',
  'password.current': 'Current password',
  'password.new': 'New password',
  'password.confirm': 'Confirm new password',
  'status.profileUpdated': 'Profile updated.',
  'status.passwordChanged': 'Password changed. Your session has been refreshed.',
  'error.passwordMismatch': 'New passwords do not match.',
  'error.unexpected': 'Unexpected error',
  'error.auth.emailAlreadyRegistered': 'Email is already registered.',
  'error.auth.invalidCredentials': 'Invalid email or password.',
  'error.auth.invalidOrExpiredToken': 'Invalid or expired token.',
  'error.auth.newPasswordMustDiffer': 'New password must be different.',
  'error.auth.userNoLongerExists': 'User no longer exists.',
  'error.validation.invalid': 'Please check the highlighted fields.',
  'reminder.title': 'Title',
  'reminder.message': 'Message',
  'reminder.scheduledFor': 'Scheduled for',
  'reminder.channel': 'Channel',
  'reminder.recipient': 'Recipient',
  'reminder.filters': 'Reminder filters',
  'reminder.noItems': 'No reminders yet.',
  'reminder.noMatches': 'No reminders match the selected filters.',
  'history.filters': 'Notification filters',
  'history.noItems': 'No delivery history yet.',
  'history.noMatches': 'No notifications match the selected filters.',
  'table.title': 'Title',
  'table.channel': 'Channel',
  'table.scheduled': 'Scheduled',
  'table.pipeline': 'Pipeline',
  'table.status': 'Status',
  'table.actions': 'Actions',
  'history.attempts': 'Attempts',
  'history.lastAttempt': 'Last attempt',
  'command.title': 'Command palette',
  'command.placeholder': 'Type a command, route, filter, or payload...',
  'command.noMatch': 'No command matched.',
  'command.openOverview.title': 'Open overview',
  'command.openOverview.hint': 'Inspect runtime topology and live event stream',
  'command.openReminders.title': 'Open reminders',
  'command.openReminders.hint': 'Jump to the create and schedule workflow',
  'command.openHistory.title': 'Open history',
  'command.openHistory.hint': 'Inspect delivery events and notification attempts',
  'command.openProfile.title': 'Open profile',
  'command.openProfile.hint': 'Review account details and security settings',
  'command.createReminder.title': 'Create reminder',
  'command.createReminder.hint': 'Open the reminder form and focus the title field',
  'command.refreshData.title': 'Refresh data',
  'command.refreshData.hint': 'Pull latest reminders and delivery events',
  'command.failedDeliveries.title': 'Filter failed deliveries',
  'command.failedDeliveries.hint': 'Switch to history and isolate failed notifications',
  'command.emailReminders.title': 'Filter email reminders',
  'command.emailReminders.hint': 'Show EMAIL reminders in the scheduling table',
  'command.inspectLatest.title': 'Inspect latest event',
  'command.inspectLatest.empty': 'No payload available yet',
  'command.changePassword.title': 'Change password',
  'command.changePassword.hint': 'Open profile security and focus the password form',
  'command.toggleTheme.hint': 'Flip the dashboard color mode',
  'command.group.navigation': 'Navigation',
  'command.group.workflow': 'Workflow',
  'command.group.runtime': 'Runtime',
  'command.group.debug': 'Debug',
  'command.group.inspector': 'Inspector',
  'command.group.account': 'Account',
  'command.group.preferences': 'Preferences',
  'inspector.payload': 'Payload',
  'aria.primaryNavigation': 'Primary navigation',
  'aria.deliveryMetrics': 'Delivery metrics',
  'aria.developerCockpit': 'Developer cockpit',
  'aria.serviceDependencies': 'Service dependencies',
  'aria.liveEventStream': 'Live event stream',
  'aria.profileSettings': 'Profile settings',
  'aria.authenticationMode': 'Authentication mode',
  'aria.deliveryPipeline': 'Delivery pipeline',
  'runtime.live': 'Live',
  'filters.all': 'All',
  'status.scheduled': 'Scheduled',
  'status.triggered': 'Triggered',
  'status.cancelled': 'Cancelled',
  'status.pending': 'Pending',
  'status.sent': 'Sent',
  'status.failed': 'Failed',
  'status.retrying': 'Retrying',
  'status.user': 'User',
  'status.admin': 'Admin',
  'pipeline.created': 'Created',
  'pipeline.scheduled': 'Scheduled',
  'pipeline.queued': 'Queued',
  'pipeline.delivery': 'Delivery',
  'pipeline.cancelled': 'Cancelled',
  'pipeline.failed': 'Failed',
  'topology.gateway.detail': 'REST 8080',
  'topology.gateway.meta': 'attempts',
  'topology.auth.detail': 'JWT',
  'topology.auth.meta': 'identity',
  'topology.reminder.detail': 'Scheduler',
  'topology.reminder.meta': 'scheduled',
  'topology.kafka.detail': 'Event bus',
  'topology.kafka.meta': 'triggered',
  'topology.notification.detail': 'Delivery',
  'topology.notification.meta': 'sent',
  'topology.storage.detail': 'State',
  'topology.storage.meta': 'watch',
  'event.waitingPayloads': 'Waiting for authenticated payloads',
  'event.noRemindersQueued': 'No reminders in the queue',
};

const emptyReminderForm = (): ReminderForm => ({
  title: '',
  message: '',
  scheduledFor: toDateTimeLocal(new Date(Date.now() + 15 * 60 * 1000).toISOString()),
  channel: 'EMAIL',
  recipient: ''
});

const emptyPasswordChangeForm = (): PasswordChangeForm => ({
  currentPassword: '',
  newPassword: '',
  confirmPassword: ''
});

const emptyRegistrationProfileForm = (): RegistrationProfileForm => ({
  firstName: '',
  lastName: '',
  phoneNumber: '',
  preferredLanguage: initialLanguage()
});

const profileFormFromUser = (user: UserSummary): ProfileForm => ({
  firstName: user.firstName,
  lastName: user.lastName,
  phoneNumber: user.phoneNumber,
  preferredLanguage: user.preferredLanguage
});

export function App() {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
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

  const isAuthenticated = Boolean(token && user);
  const t = (key: string) => messages[key] ?? DEFAULT_MESSAGES[key] ?? key;

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
    if (user) {
      setProfileForm(profileFormFromUser(user));
      setLanguage(user.preferredLanguage);
    }
  }, [user]);

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
      setError(formatError(err, t));
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
      setError(formatError(err, t));
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
      setError(formatError(err, t));
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
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      setToken(response.accessToken);
      setUser(response.user);
      setPassword('');
      setRegistrationProfile(emptyRegistrationProfileForm());
      await refreshData(response.accessToken);
    } catch (err) {
      setError(formatError(err, t));
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
      setError(formatError(err, t));
    } finally {
      setLoading(false);
    }
  }

  async function submitPasswordChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!token) {
      return;
    }

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
      const response = await changePassword(token, { currentPassword, newPassword });
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      setToken(response.accessToken);
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
    if (!token) {
      return;
    }

    setProfileSubmitting(true);
    setProfileStatus(null);
    setError(null);

    try {
      const response = await updateProfile(token, {
        firstName: profileForm.firstName.trim(),
        lastName: profileForm.lastName.trim(),
        phoneNumber: profileForm.phoneNumber.trim(),
        preferredLanguage: profileForm.preferredLanguage
      });
      localStorage.setItem(TOKEN_KEY, response.accessToken);
      setToken(response.accessToken);
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
      setError(formatError(err, t));
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
                <fieldset className="segmented-control">
                  <legend>{t('reminder.channel')}</legend>
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
                      setForm(emptyReminderForm());
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

function ServiceTopology({
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

function LiveEventConsole({
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

function CommandPalette({
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

function InspectorDrawer({
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

function ProfileSettingsPage({
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

function PasswordChangeFormView({
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

function PipelineTimeline({
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

function ThemeToggle({ theme, onToggle, t }: { theme: ThemeMode; onToggle: () => void; t: (key: string) => string }) {
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

function statusBadge(status: string, t: (key: string) => string) {
  return <span className={`badge status ${status.toLowerCase()}`}>{statusLabel(status, t)}</span>;
}

function statusFilterLabel(status: ReminderStatusFilter | NotificationStatusFilter, t: (key: string) => string) {
  return status === 'ALL' ? t('filters.all') : statusLabel(status, t);
}

function statusLabel(status: string, t: (key: string) => string) {
  const key = `status.${status.toLowerCase()}`;
  const translated = t(key);
  return translated === key ? status : translated;
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

function initialLanguage(): LanguageCode {
  const storedLanguage = localStorage.getItem(LANGUAGE_KEY);
  if (storedLanguage === 'en' || storedLanguage === 'tr') {
    return storedLanguage;
  }

  if (typeof navigator !== 'undefined' && navigator.language.toLowerCase().startsWith('tr')) {
    return 'tr';
  }

  return 'en';
}

function currentDashboardView(): DashboardView {
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

function fullName(user: UserSummary) {
  return [user.firstName, user.lastName].map((part) => part.trim()).filter(Boolean).join(' ');
}

function profileInitial(user: UserSummary) {
  return (user.firstName || user.email).trim().charAt(0).toUpperCase() || 'U';
}

function buildEventStream(reminders: Reminder[], notifications: NotificationLog[], t: (key: string) => string): EventStreamEntry[] {
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

function formatConsoleTime(value: string) {
  return new Intl.DateTimeFormat(undefined, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit'
  }).format(new Date(value));
}

function pipelineStages(status?: ReminderStatus, deliveryStatus?: DeliveryStatus): { labelKey: string; state: PipelineStageState }[] {
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

function formatError(error: unknown, translate: (key: string) => string) {
  if (error instanceof Error) {
    return translate(error.message) === error.message && error.message.startsWith('error.')
      ? error.message
      : translate(error.message);
  }
  return translate('error.unexpected');
}
