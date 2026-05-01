package com.notifyhub.reminder.domain;

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
@Table(name = "reminders")
public class Reminder {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID ownerId;

    @Column(nullable = false, length = 140)
    private String title;

    @Column(length = 1000)
    private String message;

    @Column(nullable = false)
    private Instant scheduledFor;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private NotificationChannel channel;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ReminderStatus status = ReminderStatus.SCHEDULED;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    @Column(nullable = false)
    private Instant updatedAt;

    protected Reminder() {
    }

    public Reminder(
            UUID ownerId,
            String title,
            String message,
            Instant scheduledFor,
            NotificationChannel channel
    ) {
        this.ownerId = ownerId;
        this.title = title;
        this.message = message;
        this.scheduledFor = scheduledFor;
        this.channel = channel;
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

    public void update(String title, String message, Instant scheduledFor, NotificationChannel channel) {
        this.title = title;
        this.message = message;
        this.scheduledFor = scheduledFor;
        this.channel = channel;
    }

    public UUID getId() {
        return id;
    }

    public UUID getOwnerId() {
        return ownerId;
    }

    public String getTitle() {
        return title;
    }

    public String getMessage() {
        return message;
    }

    public Instant getScheduledFor() {
        return scheduledFor;
    }

    public NotificationChannel getChannel() {
        return channel;
    }

    public ReminderStatus getStatus() {
        return status;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getUpdatedAt() {
        return updatedAt;
    }
}
