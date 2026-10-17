package com.notifyhub.reminder.service;

import com.notifyhub.common.web.RequestCorrelation;
import com.notifyhub.reminder.api.CreateReminderRequest;
import com.notifyhub.reminder.api.ReminderResponse;
import com.notifyhub.reminder.api.UpdateReminderRequest;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.repository.ReminderRepository;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.UUID;

/**
 * Write side of the reminder API: every state change goes through the {@link Reminder} aggregate.
 * Reads live in {@link ReminderQueryService}.
 */
@Service
public class ReminderCommandService {

    private final ReminderRepository reminderRepository;

    public ReminderCommandService(ReminderRepository reminderRepository) {
        this.reminderRepository = reminderRepository;
    }

    @Transactional
    public ReminderResponse create(UUID ownerId, CreateReminderRequest request) {
        Reminder reminder = new Reminder(
                ownerId,
                request.title().trim(),
                normalizeMessage(request.message()),
                request.scheduledFor(),
                request.channel(),
                normalizeRecipient(request.recipient())
        );
        reminder.assignRequestId(RequestCorrelation.currentRequestId().orElse(null));
        return ReminderResponse.from(reminderRepository.save(reminder));
    }

    @Transactional
    public ReminderResponse update(UUID ownerId, UUID id, UpdateReminderRequest request) {
        Reminder reminder = findOwnedReminder(ownerId, id);
        reminder.update(
                request.title().trim(),
                normalizeMessage(request.message()),
                request.scheduledFor(),
                request.channel(),
                normalizeRecipient(request.recipient())
        );
        return ReminderResponse.from(reminder);
    }

    @Transactional
    public void delete(UUID ownerId, UUID id) {
        Reminder reminder = findOwnedReminder(ownerId, id);
        reminderRepository.delete(reminder);
    }

    private Reminder findOwnedReminder(UUID ownerId, UUID id) {
        return reminderRepository.findByIdAndOwnerId(id, ownerId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reminder not found"));
    }

    private String normalizeMessage(String message) {
        return message == null ? null : message.trim();
    }

    private String normalizeRecipient(String recipient) {
        return recipient.trim();
    }
}
