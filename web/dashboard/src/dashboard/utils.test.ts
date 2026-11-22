import { describe, expect, it } from 'vitest';
import type { NotificationLog } from '../api';
import { latestDeliveryStatus, pipelineStages } from './utils';

const notification = (reminderId: string, status: NotificationLog['status'], createdAt: string): NotificationLog => ({
  id: `${reminderId}-${createdAt}`,
  userId: 'u1',
  reminderId,
  channel: 'EMAIL',
  recipient: 'demo@example.com',
  subject: 'Subject',
  message: 'Body',
  status,
  failureReason: null,
  idempotencyKey: null,
  attemptCount: 1,
  createdAt,
  lastAttemptAt: null,
  updatedAt: createdAt,
  sentAt: null
});

describe('pipelineStages', () => {
  it('marks every stop done once the delivery is sent', () => {
    expect(pipelineStages('TRIGGERED', 'SENT').map((stage) => stage.state)).toEqual(['done', 'done', 'done', 'done']);
  });

  it('keeps a triggered reminder without a delivery result at the queued stop', () => {
    expect(pipelineStages('TRIGGERED').map((stage) => stage.state)).toEqual(['done', 'done', 'active', 'queued']);
  });

  it('shows a failed delivery as an error on the last stop', () => {
    expect(pipelineStages('TRIGGERED', 'FAILED').at(-1)).toEqual({ labelKey: 'pipeline.failed', state: 'error' });
  });
});

describe('latestDeliveryStatus', () => {
  it('returns the newest notification status for the reminder', () => {
    const notifications = [
      notification('r1', 'RETRYING', '2026-11-22T12:40:00Z'),
      notification('r1', 'SENT', '2026-11-22T12:41:00Z'),
      notification('r2', 'FAILED', '2026-11-22T12:42:00Z')
    ];

    expect(latestDeliveryStatus(notifications, 'r1')).toBe('SENT');
    expect(latestDeliveryStatus(notifications, 'r3')).toBeUndefined();
  });
});
