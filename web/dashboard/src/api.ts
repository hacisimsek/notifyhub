export type Channel = 'EMAIL' | 'SMS' | 'PUSH';
export type ReminderStatus = 'SCHEDULED' | 'TRIGGERED' | 'CANCELLED';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';

export type UserSummary = {
  id: string;
  email: string;
  role: string;
};

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: UserSummary;
};

export type Reminder = {
  id: string;
  ownerId: string;
  title: string;
  message: string | null;
  scheduledFor: string;
  channel: Channel;
  recipient: string;
  status: ReminderStatus;
  createdAt: string;
  updatedAt: string;
};

export type ReminderPayload = {
  title: string;
  message: string;
  scheduledFor: string;
  channel: Channel;
  recipient: string;
};

export type NotificationLog = {
  id: string;
  userId: string;
  reminderId: string | null;
  channel: Channel;
  recipient: string;
  subject: string;
  message: string;
  status: DeliveryStatus;
  failureReason: string | null;
  idempotencyKey: string | null;
  createdAt: string;
  updatedAt: string;
  sentAt: string | null;
};

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL ?? '';

type RequestOptions = {
  method?: string;
  token?: string;
  body?: unknown;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  if (options.token) {
    headers.set('Authorization', `Bearer ${options.token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function register(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: { email, password }
  });
}

export function login(email: string, password: string): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/login', {
    method: 'POST',
    body: { email, password }
  });
}

export function currentUser(token: string): Promise<UserSummary> {
  return request<UserSummary>('/api/auth/me', { token });
}

export function listReminders(token: string): Promise<Reminder[]> {
  return request<Reminder[]>('/api/reminders', { token });
}

export function createReminder(token: string, payload: ReminderPayload): Promise<Reminder> {
  return request<Reminder>('/api/reminders', {
    method: 'POST',
    token,
    body: payload
  });
}

export function updateReminder(token: string, id: string, payload: ReminderPayload): Promise<Reminder> {
  return request<Reminder>(`/api/reminders/${id}`, {
    method: 'PUT',
    token,
    body: payload
  });
}

export function deleteReminder(token: string, id: string): Promise<void> {
  return request<void>(`/api/reminders/${id}`, {
    method: 'DELETE',
    token
  });
}

export function listNotifications(token: string): Promise<NotificationLog[]> {
  return request<NotificationLog[]>('/api/notifications', { token });
}
