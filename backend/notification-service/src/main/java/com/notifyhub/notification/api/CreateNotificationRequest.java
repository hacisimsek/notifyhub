package com.notifyhub.notification.api;

import com.notifyhub.common.notifications.NotificationChannel;
import jakarta.validation.constraints.Email;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.util.UUID;

public record CreateNotificationRequest(
        @NotNull UUID userId,
        UUID reminderId,
        @NotNull NotificationChannel channel,
        @Email @NotBlank @Size(max = 320) String recipient,
        @NotBlank @Size(max = 140) String subject,
        @NotBlank @Size(max = 2000) String message,
        @Size(max = 180) String idempotencyKey
) {
}
