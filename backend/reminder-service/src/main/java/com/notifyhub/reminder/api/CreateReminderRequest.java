package com.notifyhub.reminder.api;

import com.notifyhub.common.notifications.NotificationChannel;
import jakarta.validation.constraints.Future;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.time.Instant;

public record CreateReminderRequest(
        @NotBlank @Size(max = 140) String title,
        @Size(max = 1000) String message,
        @NotNull @Future Instant scheduledFor,
        @NotNull NotificationChannel channel
) {
}
