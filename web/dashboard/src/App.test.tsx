import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { App } from './App';
import * as api from './api';
import type { AuthResponse, NotificationLog, Reminder, UserSummary } from './api';

vi.mock('./api', async (importOriginal) => {
  const actual = await importOriginal<typeof import('./api')>();
  return {
    ...actual,
    changePassword: vi.fn(),
    createReminder: vi.fn(),
    currentUser: vi.fn(),
    deleteReminder: vi.fn(),
    getLanguageMessages: vi.fn(),
    listNotifications: vi.fn(),
    listReminders: vi.fn(),
    login: vi.fn(),
    register: vi.fn(),
    updateProfile: vi.fn(),
    updateReminder: vi.fn()
  };
});

const mockedApi = vi.mocked(api);

const user: UserSummary = {
  id: 'user-1',
  email: 'user@example.com',
  role: 'USER',
  firstName: 'Haci',
  lastName: 'Simsek',
  phoneNumber: '+905551112233',
  preferredLanguage: 'en'
};

const reminders: Reminder[] = [
  reminder({
    id: 'reminder-1',
    title: 'Pay invoice',
    channel: 'EMAIL',
    status: 'SCHEDULED',
    recipient: 'billing@example.com'
  }),
  reminder({
    id: 'reminder-2',
    title: 'Send report',
    channel: 'SMS',
    status: 'TRIGGERED',
    recipient: '+905551112233'
  })
];

const notifications: NotificationLog[] = [
  notification({
    id: 'notification-1',
    subject: 'Pay invoice',
    channel: 'EMAIL',
    status: 'SENT',
    attemptCount: 1
  }),
  notification({
    id: 'notification-2',
    subject: 'Send report',
    channel: 'SMS',
    status: 'RETRYING',
    attemptCount: 2
  })
];

describe('App dashboard', () => {
  beforeEach(() => {
    vi.setSystemTime(new Date('2026-05-02T12:00:00.000Z'));
    mockedApi.currentUser.mockResolvedValue(user);
    mockedApi.getLanguageMessages.mockResolvedValue({ language: 'en', messages: {} });
    mockedApi.changePassword.mockResolvedValue(authResponse({ accessToken: 'token-2' }));
    mockedApi.login.mockResolvedValue(authResponse());
    mockedApi.register.mockResolvedValue(authResponse());
    mockedApi.updateProfile.mockResolvedValue(authResponse());
    mockedApi.createReminder.mockResolvedValue(reminder({ id: 'created-reminder', title: 'Created reminder' }));
    mockedApi.updateReminder.mockResolvedValue(reminder({ id: 'updated-reminder', title: 'Updated reminder' }));
    mockedApi.deleteReminder.mockResolvedValue();
    mockedApi.listReminders.mockImplementation(async (_token, filters = {}) => {
      return reminders.filter((item) => {
        return (!filters.status || item.status === filters.status)
          && (!filters.channel || item.channel === filters.channel);
      });
    });
    mockedApi.listNotifications.mockImplementation(async (_token, filters = {}) => {
      return notifications.filter((item) => {
        return (!filters.status || item.status === filters.status)
          && (!filters.channel || item.channel === filters.channel);
      });
    });
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.clearAllMocks();
  });

  it('signs in and loads the authenticated dashboard', async () => {
    const actor = userEvent.setup();
    render(<App />);

    await actor.type(screen.getByLabelText('Email'), 'user@example.com');
    await actor.type(screen.getByLabelText('Password'), 'secret123');
    await actor.click(screen.getByRole('button', { name: /sign in/i }));

    expect(mockedApi.login).toHaveBeenCalledWith('user@example.com', 'secret123');
    await screen.findByRole('heading', { name: 'Operations overview' });
    expect(localStorage.getItem('notifyhub.dashboard.token')).toBe('token-1');
    expect(screen.getByRole('heading', { name: 'Service topology' })).toBeInTheDocument();
    await actor.click(screen.getByRole('link', { name: /reminders/i }));
    expect(within(remindersPanel()).getByText('Pay invoice')).toBeInTheDocument();
  });

  it('registers with profile details', async () => {
    const actor = userEvent.setup();
    render(<App />);

    await actor.click(screen.getByRole('button', { name: /register/i }));
    await actor.type(screen.getByLabelText('First name'), 'Haci');
    await actor.type(screen.getByLabelText('Last name'), 'Simsek');
    await actor.type(screen.getByLabelText('Email'), 'user@example.com');
    await actor.type(screen.getByLabelText('Phone number'), '+905551112233');
    await actor.type(screen.getByLabelText('Password'), 'secret123');
    await actor.click(screen.getByRole('button', { name: /create account/i }));

    expect(mockedApi.register).toHaveBeenCalledWith({
      email: 'user@example.com',
      firstName: 'Haci',
      lastName: 'Simsek',
      phoneNumber: '+905551112233',
      preferredLanguage: 'en',
      password: 'secret123'
    });
    await screen.findByRole('heading', { name: 'Operations overview' });
  });

  it('toggles and persists the dark theme preference', async () => {
    const actor = userEvent.setup();
    render(<App />);

    await actor.click(screen.getByRole('button', { name: /switch to dark theme/i }));

    await waitFor(() => {
      expect(document.documentElement.dataset.theme).toBe('dark');
    });
    expect(localStorage.getItem('notifyhub.dashboard.theme')).toBe('dark');
    expect(screen.getByRole('button', { name: /switch to light theme/i })).toBeInTheDocument();
  });

  it('creates reminders with trimmed form values and refreshes data', async () => {
    const actor = userEvent.setup();
    await renderAuthenticatedDashboard();
    vi.clearAllMocks();

    await actor.click(screen.getByRole('link', { name: /reminders/i }));
    await actor.type(screen.getByLabelText('Title'), '  Demo reminder  ');
    await actor.type(screen.getByLabelText('Message'), '  Follow up with finance  ');
    await actor.type(screen.getByLabelText('Recipient'), '  demo@example.com  ');
    await actor.click(screen.getByRole('button', { name: /add reminder/i }));

    await waitFor(() => {
      expect(mockedApi.createReminder).toHaveBeenCalledWith('token-1', expect.objectContaining({
        title: 'Demo reminder',
        message: 'Follow up with finance',
        channel: 'EMAIL',
        recipient: 'demo@example.com'
      }));
    });
    expect(mockedApi.listReminders).toHaveBeenCalled();
    expect(mockedApi.listNotifications).toHaveBeenCalled();
  });

  it('switches the dashboard content from the side navigation route', async () => {
    const actor = userEvent.setup();
    await renderAuthenticatedDashboard();

    expect(screen.getByRole('heading', { name: 'Service topology' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Live console' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reminders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Notifications' })).not.toBeInTheDocument();

    await actor.click(screen.getByRole('link', { name: /reminders/i }));

    expect(window.location.hash).toBe('#reminders');
    expect(screen.getAllByRole('heading', { name: 'Reminders' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Service topology' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Live console' })).not.toBeInTheDocument();

    await actor.click(screen.getByRole('link', { name: /history/i }));

    expect(window.location.hash).toBe('#history');
    expect(screen.getByRole('heading', { name: 'Notification history' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'History' })).toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Reminders' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Service topology' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /history/i })).toHaveAttribute('aria-current', 'page');

    await actor.click(screen.getByRole('link', { name: /profile/i }));

    expect(window.location.hash).toBe('#profile');
    expect(screen.getAllByRole('heading', { name: 'Profile' }).length).toBeGreaterThan(0);
    expect(screen.getByRole('heading', { name: 'Password' })).toBeInTheDocument();
    expect(screen.getAllByText('user@example.com').length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'Service topology' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: /profile/i })).toHaveAttribute('aria-current', 'page');

    await actor.click(screen.getByRole('link', { name: /reminders/i }));

    expect(window.location.hash).toBe('#reminders');
    expect(screen.getAllByRole('heading', { name: 'Reminders' }).length).toBeGreaterThan(0);
    expect(screen.queryByRole('heading', { name: 'History' })).not.toBeInTheDocument();
    expect(screen.queryByRole('heading', { name: 'Service topology' })).not.toBeInTheDocument();
  });

  it('supports command palette navigation and payload inspection', async () => {
    const actor = userEvent.setup();
    await renderAuthenticatedDashboard();

    await actor.click(screen.getByRole('button', { name: /command/i }));
    expect(screen.getByRole('dialog', { name: 'Command palette' })).toBeInTheDocument();

    await actor.type(screen.getByRole('textbox', { name: 'Command palette' }), 'history');
    await actor.click(screen.getByRole('button', { name: /open history/i }));

    expect(window.location.hash).toBe('#history');
    expect(screen.getByRole('heading', { name: 'Notification history' })).toBeInTheDocument();

    await actor.click(screen.getAllByRole('button', { name: /inspect payload/i })[0]);

    expect(screen.getByRole('dialog', { name: /pay invoice|send report/i })).toBeInTheDocument();
    expect(screen.getByText(/"recipient"/i)).toBeInTheDocument();
  });

  it('changes the current user password from the profile page', async () => {
    const actor = userEvent.setup();
    await renderAuthenticatedDashboard();
    mockedApi.changePassword.mockClear();
    mockedApi.changePassword.mockResolvedValue(authResponse({ accessToken: 'token-2' }));

    await actor.click(screen.getByRole('link', { name: /profile/i }));
    const profilePage = screen.getByLabelText('Profile settings');

    await actor.type(within(profilePage).getByLabelText('Current password'), 'secret123');
    await actor.type(within(profilePage).getByLabelText('New password'), 'newSecret123');
    await actor.type(within(profilePage).getByLabelText('Confirm new password'), 'newSecret123');
    await actor.click(within(profilePage).getByRole('button', { name: /change password/i }));

    await waitFor(() => {
      expect(mockedApi.changePassword).toHaveBeenCalledWith('token-1', {
        currentPassword: 'secret123',
        newPassword: 'newSecret123'
      });
    });
    expect(localStorage.getItem('notifyhub.dashboard.token')).toBe('token-2');
    expect(within(profilePage).getByText(/password changed/i)).toBeInTheDocument();
  });

  it('updates profile details from the profile page', async () => {
    const actor = userEvent.setup();
    mockedApi.getLanguageMessages.mockImplementation(async (language) => {
      const messages: Record<string, string> = language === 'tr' ? {
        'actions.saveProfile': 'Profili kaydet',
        'auth.firstName': 'İsim',
        'auth.lastName': 'Soyisim',
        'auth.phoneNumber': 'Telefon numarası',
        'profile.language': 'Dil',
        'status.profileUpdated': 'Profil güncellendi.'
      } : {};

      return { language, messages };
    });
    await renderAuthenticatedDashboard();
    mockedApi.updateProfile.mockClear();
    mockedApi.updateProfile.mockResolvedValue(authResponse({
      accessToken: 'token-3',
      user: {
        ...user,
        firstName: 'Updated',
        lastName: 'User',
        phoneNumber: '+905559998877',
        preferredLanguage: 'tr'
      }
    }));

    await actor.click(screen.getByRole('link', { name: /profile/i }));
    const profilePage = screen.getByLabelText('Profile settings');

    await actor.clear(within(profilePage).getByLabelText('First name'));
    await actor.type(within(profilePage).getByLabelText('First name'), 'Updated');
    await actor.clear(within(profilePage).getByLabelText('Last name'));
    await actor.type(within(profilePage).getByLabelText('Last name'), 'User');
    await actor.clear(within(profilePage).getByLabelText('Phone number'));
    await actor.type(within(profilePage).getByLabelText('Phone number'), '+905559998877');
    await actor.selectOptions(within(profilePage).getByLabelText('Language'), 'tr');
    await waitFor(() => expect(within(profilePage).getByRole('button', { name: 'Profili kaydet' })).toBeInTheDocument());
    await actor.click(within(profilePage).getByRole('button', { name: 'Profili kaydet' }));

    await waitFor(() => {
      expect(mockedApi.updateProfile).toHaveBeenCalledWith('token-1', {
        firstName: 'Updated',
        lastName: 'User',
        phoneNumber: '+905559998877',
        preferredLanguage: 'tr'
      });
    });
    expect(localStorage.getItem('notifyhub.dashboard.token')).toBe('token-3');
    expect(within(profilePage).getByText(/profil güncellendi/i)).toBeInTheDocument();
  });

  it('requests filtered reminder and notification views from the gateway API', async () => {
    const actor = userEvent.setup();
    await renderAuthenticatedDashboard();
    vi.clearAllMocks();

    await actor.click(screen.getByRole('link', { name: /reminders/i }));
    await actor.click(within(screen.getByLabelText('Reminder filters')).getByRole('button', { name: 'Scheduled' }));

    await waitFor(() => {
      expect(mockedApi.listReminders).toHaveBeenCalledWith('token-1', {
        status: 'SCHEDULED',
        channel: undefined
      });
    });
    expect(within(remindersPanel()).getByText('Pay invoice')).toBeInTheDocument();
    expect(within(remindersPanel()).queryByText('Send report')).not.toBeInTheDocument();

    vi.clearAllMocks();
    await actor.click(screen.getByRole('link', { name: /history/i }));
    await actor.click(within(screen.getByLabelText('Notification filters')).getByRole('button', { name: 'Sent' }));
    await actor.click(within(screen.getByLabelText('Notification filters')).getByRole('button', { name: 'EMAIL' }));

    await waitFor(() => {
      expect(mockedApi.listNotifications).toHaveBeenCalledWith('token-1', {
        status: 'SENT',
        channel: 'EMAIL'
      });
    });
  });
});

async function renderAuthenticatedDashboard() {
  localStorage.setItem('notifyhub.dashboard.token', 'token-1');
  render(<App />);
  await screen.findByRole('heading', { name: 'Operations overview' });
}

function remindersPanel() {
  return document.getElementById('reminders') as HTMLElement;
}

function authResponse(overrides: Partial<AuthResponse> = {}): AuthResponse {
  return {
    accessToken: 'token-1',
    tokenType: 'Bearer',
    expiresAt: '2026-05-02T14:00:00.000Z',
    user,
    ...overrides
  };
}

function reminder(overrides: Partial<Reminder> = {}): Reminder {
  return {
    id: 'reminder-1',
    ownerId: 'user-1',
    title: 'Pay invoice',
    message: 'Invoice is due tomorrow',
    scheduledFor: '2026-05-04T10:00:00.000Z',
    channel: 'EMAIL',
    recipient: 'billing@example.com',
    status: 'SCHEDULED',
    createdAt: '2026-05-02T10:00:00.000Z',
    updatedAt: '2026-05-02T10:00:00.000Z',
    ...overrides
  };
}

function notification(overrides: Partial<NotificationLog> = {}): NotificationLog {
  return {
    id: 'notification-1',
    userId: 'user-1',
    reminderId: 'reminder-1',
    channel: 'EMAIL',
    recipient: 'billing@example.com',
    subject: 'Pay invoice',
    message: 'Invoice is due tomorrow',
    status: 'SENT',
    failureReason: null,
    idempotencyKey: 'reminder-1-2026-05-04',
    attemptCount: 1,
    createdAt: '2026-05-02T10:00:00.000Z',
    lastAttemptAt: '2026-05-02T10:01:00.000Z',
    updatedAt: '2026-05-02T10:01:00.000Z',
    sentAt: '2026-05-02T10:01:00.000Z',
    ...overrides
  };
}
