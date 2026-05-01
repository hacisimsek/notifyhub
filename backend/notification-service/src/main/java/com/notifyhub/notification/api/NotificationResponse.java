package com.notifyhub.notification.api;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.domain.NotificationLog;

import java.time.Instant;
import java.util.UUID;

public record NotificationResponse(
        UUID id,
        UUID userId,
        UUID reminderId,
        NotificationChannel channel,
        String recipient,
        String subject,
        String message,
        DeliveryStatus status,
        String failureReason,
        String idempotencyKey,
        Instant createdAt,
        Instant sentAt
) {
    public static NotificationResponse from(NotificationLog log) {
        return new NotificationResponse(
                log.getId(),
                log.getUserId(),
                log.getReminderId(),
                log.getChannel(),
                log.getRecipient(),
                log.getSubject(),
                log.getMessage(),
                log.getStatus(),
                log.getFailureReason(),
                log.getIdempotencyKey(),
                log.getCreatedAt(),
                log.getSentAt()
        );
    }
}
