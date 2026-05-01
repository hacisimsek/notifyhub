package com.notifyhub.common.events;

import java.time.Instant;
import java.util.UUID;

public record ReminderTriggeredEvent(
        UUID eventId,
        UUID reminderId,
        UUID userId,
        String title,
        String message,
        Instant scheduledFor,
        Instant triggeredAt,
        String idempotencyKey
) {
}
