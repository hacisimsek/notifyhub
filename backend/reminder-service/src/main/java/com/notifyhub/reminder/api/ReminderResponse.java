package com.notifyhub.reminder.api;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;

import java.time.Instant;
import java.util.UUID;

public record ReminderResponse(
        UUID id,
        UUID ownerId,
        String title,
        String message,
        Instant scheduledFor,
        NotificationChannel channel,
        ReminderStatus status,
        Instant createdAt,
        Instant updatedAt
) {
    public static ReminderResponse from(Reminder reminder) {
        return new ReminderResponse(
                reminder.getId(),
                reminder.getOwnerId(),
                reminder.getTitle(),
                reminder.getMessage(),
                reminder.getScheduledFor(),
                reminder.getChannel(),
                reminder.getStatus(),
                reminder.getCreatedAt(),
                reminder.getUpdatedAt()
        );
    }
}
