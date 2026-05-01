package com.notifyhub.notification.domain;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.EnumType;
import jakarta.persistence.Enumerated;
import jakarta.persistence.GeneratedValue;
import jakarta.persistence.Id;
import jakarta.persistence.PrePersist;
import jakarta.persistence.PreUpdate;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "notification_logs")
public class NotificationLog {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    private UUID reminderId;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationChannel channel;

    @Column(nullable = false, length = 320)
    private String recipient;

    @Column(nullable = false, length = 140)
    private String subject;

    @Column(nullable = false, length = 2000)
    private String message;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private DeliveryStatus status = DeliveryStatus.PENDING;

    @Column(length = 500)
    private String failureReason;

    @Column(length = 180, unique = true)
    private String idempotencyKey;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    private Instant sentAt;

    protected NotificationLog() {
    }

    public NotificationLog(
            UUID userId,
            UUID reminderId,
            NotificationChannel channel,
            String recipient,
            String subject,
            String message,
            String idempotencyKey
    ) {
        this.userId = userId;
        this.reminderId = reminderId;
        this.channel = channel;
        this.recipient = recipient;
        this.subject = subject;
        this.message = message;
        this.idempotencyKey = idempotencyKey;
    }

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }

    public void markSent() {
        status = DeliveryStatus.SENT;
        failureReason = null;
        sentAt = Instant.now();
    }

    public void markFailed(String reason) {
        status = DeliveryStatus.FAILED;
        failureReason = reason;
        sentAt = null;
    }

    public UUID getId() {
        return id;
    }

    public UUID getUserId() {
        return userId;
    }

    public UUID getReminderId() {
        return reminderId;
    }

    public NotificationChannel getChannel() {
        return channel;
    }

    public String getRecipient() {
        return recipient;
    }

    public String getSubject() {
        return subject;
    }

    public String getMessage() {
        return message;
    }

    public DeliveryStatus getStatus() {
        return status;
    }

    public String getFailureReason() {
        return failureReason;
    }

    public String getIdempotencyKey() {
        return idempotencyKey;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }

    public Instant getSentAt() {
        return sentAt;
    }
}
