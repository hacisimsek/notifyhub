import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  changePassword,
  createReminder,
  deleteReminder,
  getLanguageMessages,
  isUnauthorized,
  listNotifications,
  listReminders,
  login,
  logout,
  register,
  updateProfile
} from './api';

describe('dashboard api client', () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('sends auth requests with a JSON body', async () => {
    const fetchMock = mockFetch({ accessToken: 'token-1' });

    await login('user@example.com', 'secret123');

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/login', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({ email: 'user@example.com', password: 'secret123' })
    }));
    expect(headersFor(options).get('Accept')).toBe('application/json');
    expect(headersFor(options).get('Content-Type')).toBe('application/json');
  });

  it('sends registration profile fields', async () => {
    const fetchMock = mockFetch({ accessToken: 'token-1' });

    await register({
      email: 'user@example.com',
      firstName: 'Haci',
      lastName: 'Simsek',
      phoneNumber: '+905551112233',
      preferredLanguage: 'en',
      password: 'secret123'
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/register', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        email: 'user@example.com',
        firstName: 'Haci',
        lastName: 'Simsek',
        phoneNumber: '+905551112233',
        preferredLanguage: 'en',
        password: 'secret123'
      })
    }));
    expect(headersFor(options).get('Content-Type')).toBe('application/json');
  });

  it('encodes reminder filters and uses the session cookie', async () => {
    const fetchMock = mockFetch([]);

    await listReminders({ status: 'SCHEDULED', channel: 'EMAIL' });

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith('/api/reminders?status=SCHEDULED&channel=EMAIL', expect.objectContaining({
      method: 'GET',
      body: undefined
    }));
    expect(headersFor(options).get('Accept')).toBe('application/json');
    expectCookieSession(options);
  });

  it('sends password changes with the session cookie and JSON payload', async () => {
    const fetchMock = mockFetch({ accessToken: 'token-2' });

    await changePassword({
      currentPassword: 'secret123',
      newPassword: 'newSecret123'
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/password', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        currentPassword: 'secret123',
        newPassword: 'newSecret123'
      })
    }));
    expectCookieSession(options);
    expect(headersFor(options).get('Content-Type')).toBe('application/json');
  });

  it('updates profile details with the session cookie', async () => {
    const fetchMock = mockFetch({ accessToken: 'token-2' });

    await updateProfile({
      firstName: 'Haci',
      lastName: 'Simsek',
      phoneNumber: '+905551112233',
      preferredLanguage: 'tr'
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith('/api/auth/profile', expect.objectContaining({
      method: 'PUT',
      body: JSON.stringify({
        firstName: 'Haci',
        lastName: 'Simsek',
        phoneNumber: '+905551112233',
        preferredLanguage: 'tr'
      })
    }));
    expectCookieSession(options);
    expect(headersFor(options).get('Content-Type')).toBe('application/json');
  });

  it('fetches backend language messages', async () => {
    const fetchMock = mockFetch({ language: 'tr', messages: { 'auth.login': 'Giriş' } });

    await getLanguageMessages('tr');

    expect(fetchMock).toHaveBeenCalledWith('/api/i18n/messages?language=tr', expect.objectContaining({
      method: 'GET',
      body: undefined
    }));
  });

  it('encodes notification filters and handles empty deletes', async () => {
    const fetchMock = vi.fn()
      .mockResolvedValueOnce(jsonResponse([]))
      .mockResolvedValueOnce(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await listNotifications({ status: 'SENT', channel: 'SMS' });
    await deleteReminder('reminder-1');

    const [, notificationOptions] = fetchMock.mock.calls[0];
    const [, deleteOptions] = fetchMock.mock.calls[1];
    expect(fetchMock).toHaveBeenNthCalledWith(1, '/api/notifications?status=SENT&channel=SMS', expect.objectContaining({
      method: 'GET',
      body: undefined
    }));
    expect(fetchMock).toHaveBeenNthCalledWith(2, '/api/reminders/reminder-1', expect.objectContaining({
      method: 'DELETE',
      body: undefined
    }));
    expectCookieSession(notificationOptions);
    expectCookieSession(deleteOptions);
  });

  it('forwards reminder creation payloads', async () => {
    const fetchMock = mockFetch({ id: 'reminder-1' });

    await createReminder({
      title: 'Pay invoice',
      message: 'Due tomorrow',
      scheduledFor: '2026-05-04T10:00:00.000Z',
      channel: 'PUSH',
      recipient: 'push-target-id'
    });

    const [, options] = fetchMock.mock.calls[0];
    expect(fetchMock).toHaveBeenCalledWith('/api/reminders', expect.objectContaining({
      method: 'POST',
      body: JSON.stringify({
        title: 'Pay invoice',
        message: 'Due tomorrow',
        scheduledFor: '2026-05-04T10:00:00.000Z',
        channel: 'PUSH',
        recipient: 'push-target-id'
      })
    }));
    expectCookieSession(options);
    expect(headersFor(options).get('Content-Type')).toBe('application/json');
  });

  it('asks the gateway to clear the session cookie on logout', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response(null, { status: 204 }));
    vi.stubGlobal('fetch', fetchMock);

    await logout();

    expect(fetchMock).toHaveBeenCalledWith('/api/auth/logout', expect.objectContaining({ method: 'POST' }));
  });

  it('marks 401 responses so the app can end the session', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(
      JSON.stringify({ message: 'error.auth.sessionRevoked' }),
      { status: 401, headers: { 'Content-Type': 'application/json' } }
    )));

    const error = await listReminders().catch((err: unknown) => err);

    expect(isUnauthorized(error)).toBe(true);
    expect((error as Error).message).toBe('error.auth.sessionRevoked');
  });
});

function expectCookieSession(options: RequestInit | undefined) {
  expect(options?.credentials).toBe('same-origin');
  expect(headersFor(options).get('X-NotifyHub-Client')).toBe('dashboard');
  expect(headersFor(options).get('Authorization')).toBeNull();
}

function mockFetch(body: unknown) {
  const fetchMock = vi.fn().mockResolvedValue(jsonResponse(body));
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

function jsonResponse(body: unknown) {
  return new Response(JSON.stringify(body), {
    status: 200,
    headers: { 'Content-Type': 'application/json' }
  });
}

function headersFor(options: RequestInit | undefined) {
  expect(options?.headers).toBeInstanceOf(Headers);
  return options?.headers as Headers;
}
