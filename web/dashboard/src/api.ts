export type Channel = 'EMAIL' | 'SMS' | 'PUSH';
export type ReminderStatus = 'SCHEDULED' | 'TRIGGERED' | 'CANCELLED';
export type DeliveryStatus = 'PENDING' | 'SENT' | 'FAILED' | 'RETRYING';
export type LanguageCode = 'en' | 'tr';

export type UserSummary = {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  preferredLanguage: LanguageCode;
  createdAt?: string;
};

export type AuthResponse = {
  accessToken: string;
  tokenType: string;
  expiresAt: string;
  user: UserSummary;
};

export type ChangePasswordPayload = {
  currentPassword: string;
  newPassword: string;
};

export type RegisterPayload = {
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  preferredLanguage: LanguageCode;
  password: string;
};

export type UpdateProfilePayload = {
  firstName: string;
  lastName: string;
  phoneNumber: string;
  preferredLanguage: LanguageCode;
};

export type LanguageMessagesResponse = {
  language: LanguageCode;
  messages: Record<string, string>;
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

export type ReminderFilters = {
  status?: ReminderStatus;
  channel?: Channel;
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
  attemptCount: number;
  createdAt: string;
  lastAttemptAt: string | null;
  updatedAt: string;
  sentAt: string | null;
};

export type NotificationFilters = {
  status?: DeliveryStatus;
  channel?: Channel;
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
    throw new Error(errorMessage(errorText) || `Request failed with ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export function register(payload: RegisterPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/register', {
    method: 'POST',
    body: payload
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

export function changePassword(token: string, payload: ChangePasswordPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/password', {
    method: 'POST',
    token,
    body: payload
  });
}

export function updateProfile(token: string, payload: UpdateProfilePayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/profile', {
    method: 'PUT',
    token,
    body: payload
  });
}

export function getLanguageMessages(language: LanguageCode): Promise<LanguageMessagesResponse> {
  return request<LanguageMessagesResponse>(`/api/i18n/messages?language=${language}`);
}

export function listReminders(token: string, filters: ReminderFilters = {}): Promise<Reminder[]> {
  return request<Reminder[]>(`/api/reminders${queryString(filters)}`, { token });
}

function errorMessage(errorText: string) {
  if (!errorText) {
    return '';
  }
  try {
    const parsed = JSON.parse(errorText) as { message?: string; error?: string };
    return parsed.message || parsed.error || errorText;
  } catch {
    return errorText;
  }
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

export function listNotifications(token: string, filters: NotificationFilters = {}): Promise<NotificationLog[]> {
  return request<NotificationLog[]>(`/api/notifications${queryString(filters)}`, { token });
}

function queryString(filters: ReminderFilters | NotificationFilters) {
  const params = new URLSearchParams();
  if (filters.status) {
    params.set('status', filters.status);
  }
  if (filters.channel) {
    params.set('channel', filters.channel);
  }

  const encoded = params.toString();
  return encoded ? `?${encoded}` : '';
}
