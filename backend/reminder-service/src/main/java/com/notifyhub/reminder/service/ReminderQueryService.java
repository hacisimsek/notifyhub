package com.notifyhub.reminder.service;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.api.ReminderResponse;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.repository.ReminderQueryRepository;
import org.springframework.data.domain.Pageable;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.server.ResponseStatusException;

import java.util.List;
import java.util.UUID;

/**
 * Read side of the reminder API. Queries project straight into {@link ReminderResponse}, so no managed
 * entities are loaded and nothing here can change reminder state.
 */
@Service
@Transactional(readOnly = true)
public class ReminderQueryService {

    private final ReminderQueryRepository reminderQueryRepository;

    public ReminderQueryService(ReminderQueryRepository reminderQueryRepository) {
        this.reminderQueryRepository = reminderQueryRepository;
    }

    public List<ReminderResponse> list(UUID ownerId, ReminderStatus status, NotificationChannel channel, Pageable pageable) {
        return reminderQueryRepository.findOwnerReminders(ownerId, status, channel, pageable);
    }

    public ReminderResponse get(UUID ownerId, UUID id) {
        return reminderQueryRepository.findOwnerReminder(ownerId, id)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Reminder not found"));
    }
}
