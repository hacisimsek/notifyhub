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
  body?: unknown;
};

// The session token lives in an HttpOnly cookie set by the Gateway; this header proves the call came from the
// dashboard (cross-site forms cannot send it), which is what lets the Gateway accept the cookie.
export const CLIENT_HEADER = 'X-NotifyHub-Client';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
    this.name = 'ApiError';
  }
}

export function isUnauthorized(error: unknown) {
  return error instanceof ApiError && error.status === 401;
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const headers = new Headers();
  headers.set('Accept', 'application/json');
  headers.set(CLIENT_HEADER, 'dashboard');

  if (options.body !== undefined) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method ?? 'GET',
    headers,
    credentials: 'same-origin',
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(errorMessage(errorText) || `Request failed with ${response.status}`, response.status);
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

export function logout(): Promise<void> {
  return request<void>('/api/auth/logout', { method: 'POST' });
}

export function currentUser(): Promise<UserSummary> {
  return request<UserSummary>('/api/auth/me');
}

export function changePassword(payload: ChangePasswordPayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/password', {
    method: 'POST',
    body: payload
  });
}

export function updateProfile(payload: UpdateProfilePayload): Promise<AuthResponse> {
  return request<AuthResponse>('/api/auth/profile', {
    method: 'PUT',
    body: payload
  });
}

export function getLanguageMessages(language: LanguageCode): Promise<LanguageMessagesResponse> {
  return request<LanguageMessagesResponse>(`/api/i18n/messages?language=${language}`);
}

export function listReminders(filters: ReminderFilters = {}): Promise<Reminder[]> {
  return request<Reminder[]>(`/api/reminders${queryString(filters)}`);
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

export function createReminder(payload: ReminderPayload): Promise<Reminder> {
  return request<Reminder>('/api/reminders', {
    method: 'POST',
    body: payload
  });
}

export function updateReminder(id: string, payload: ReminderPayload): Promise<Reminder> {
  return request<Reminder>(`/api/reminders/${id}`, {
    method: 'PUT',
    body: payload
  });
}

export function deleteReminder(id: string): Promise<void> {
  return request<void>(`/api/reminders/${id}`, {
    method: 'DELETE'
  });
}

export function listNotifications(filters: NotificationFilters = {}): Promise<NotificationLog[]> {
  return request<NotificationLog[]>(`/api/notifications${queryString(filters)}`);
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
