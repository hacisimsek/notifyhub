package com.notifyhub.notification.domain;

import com.notifyhub.common.notifications.DeliveryStatus;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_delivery_attempts")
public class NotificationDeliveryAttempt {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID notificationLogId;

    @Column(nullable = false)
    private int attemptNumber;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DeliveryStatus status;

    @Column(length = 500)
    private String failureReason;

    @Column(nullable = false, updatable = false)
    private Instant attemptedAt;

    protected NotificationDeliveryAttempt() {
    }

    private NotificationDeliveryAttempt(
            UUID notificationLogId,
            int attemptNumber,
            DeliveryStatus status,
            String failureReason
    ) {
        this.notificationLogId = notificationLogId;
        this.attemptNumber = attemptNumber;
        this.status = status;
        this.failureReason = failureReason;
        this.attemptedAt = Instant.now();
    }

    public static NotificationDeliveryAttempt create(
            UUID notificationLogId,
            int attemptNumber,
            DeliveryStatus status,
            String failureReason
    ) {
        return new NotificationDeliveryAttempt(notificationLogId, attemptNumber, status, failureReason);
    }

    public UUID getId() {
        return id;
    }

    public UUID getNotificationLogId() {
        return notificationLogId;
    }

    public int getAttemptNumber() {
        return attemptNumber;
    }

    public DeliveryStatus getStatus() {
        return status;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public Instant getAttemptedAt() {
        return attemptedAt;
    }
}
