package com.notifyhub.common.events;

import com.notifyhub.common.notifications.NotificationChannel;

import java.time.Instant;
import java.util.UUID;

public record ReminderTriggeredEvent(
        UUID eventId,
        UUID reminderId,
        UUID userId,
        NotificationChannel channel,
        String recipient,
        String title,
        String message,
        Instant scheduledFor,
        Instant triggeredAt,
        String idempotencyKey
) {
}
