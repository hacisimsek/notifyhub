package com.notifyhub.reminder.domain;

import jakarta.persistence.Column;
import jakarta.persistence.Entity;
import jakarta.persistence.Id;
import jakarta.persistence.Table;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "reminder_outbox_events")
public class ReminderOutboxEvent {

    @Id
    private UUID id;

    @Column(nullable = false)
    private UUID reminderId;

    @Column(nullable = false, columnDefinition = "TEXT")
    private String payload;

    @Column(nullable = false, updatable = false)
    private Instant createdAt;

    private Instant publishedAt;

    protected ReminderOutboxEvent() {
    }

    public ReminderOutboxEvent(UUID id, UUID reminderId, String payload, Instant createdAt) {
        this.id = id;
        this.reminderId = reminderId;
        this.payload = payload;
        this.createdAt = createdAt;
    }

    public void markPublished(Instant publishedAt) {
        this.publishedAt = publishedAt;
    }

    public UUID getId() {
        return id;
    }

    public UUID getReminderId() {
        return reminderId;
    }

    public String getPayload() {
        return payload;
    }

    public Instant getCreatedAt() {
        return createdAt;
    }

    public Instant getPublishedAt() {
        return publishedAt;
    }
}
