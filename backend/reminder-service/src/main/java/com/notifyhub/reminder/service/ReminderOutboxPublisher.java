package com.notifyhub.reminder.service;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.reminder.domain.ReminderOutboxEvent;
import com.notifyhub.reminder.messaging.ReminderEventPublisher;
import com.notifyhub.reminder.repository.ReminderOutboxEventRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.time.Instant;

@Service
public class ReminderOutboxPublisher {

    private static final Logger LOGGER = LoggerFactory.getLogger(ReminderOutboxPublisher.class);

    private final ReminderOutboxEventRepository outboxEventRepository;
    private final ReminderEventPublisher eventPublisher;
    private final ObjectMapper objectMapper;

    public ReminderOutboxPublisher(
            ReminderOutboxEventRepository outboxEventRepository,
            ReminderEventPublisher eventPublisher,
            ObjectMapper objectMapper
    ) {
        this.outboxEventRepository = outboxEventRepository;
        this.eventPublisher = eventPublisher;
        this.objectMapper = objectMapper;
    }

    /**
     * Publishes pending outbox events in order. Stops at the first failure so the remaining events
     * stay pending for the next run; consumers deduplicate with the event's idempotency key.
     */
    @Transactional
    public int publishPending() {
        int published = 0;
        for (ReminderOutboxEvent outboxEvent : outboxEventRepository.findTop50ByPublishedAtIsNullOrderByCreatedAtAsc()) {
            try {
                eventPublisher.publish(fromJson(outboxEvent));
            } catch (RuntimeException ex) {
                LOGGER.warn("Publishing outbox event {} failed; will retry", outboxEvent.getId(), ex);
                break;
            }
            outboxEvent.markPublished(Instant.now());
            published++;
        }
        return published;
    }

    private ReminderTriggeredEvent fromJson(ReminderOutboxEvent outboxEvent) {
        try {
            return objectMapper.readValue(outboxEvent.getPayload(), ReminderTriggeredEvent.class);
        } catch (JsonProcessingException ex) {
            throw new IllegalStateException("Could not deserialize outbox event " + outboxEvent.getId(), ex);
        }
    }
}
