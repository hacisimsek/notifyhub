package com.notifyhub.reminder.api;

import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.service.ReminderService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.DeleteMapping;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/reminders")
class ReminderController {

    private static final Logger LOGGER = LoggerFactory.getLogger(ReminderController.class);

    private final ReminderService reminderService;

    ReminderController(ReminderService reminderService) {
        this.reminderService = reminderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ReminderResponse create(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @Valid @RequestBody CreateReminderRequest request
    ) {
        ReminderResponse response = reminderService.create(userId, request);
        audit("reminder.created", "User %s created reminder %s".formatted(displayUser(userId, userEmail), response.id()), userId, userEmail)
                .resource("reminder", response.id())
                .detail("title", response.title())
                .detail("channel", response.channel())
                .detail("recipient", response.recipient())
                .detail("scheduledFor", response.scheduledFor())
                .log();
        return response;
    }

    @GetMapping
    List<ReminderResponse> list(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestParam(required = false) ReminderStatus status,
            @RequestParam(required = false) NotificationChannel channel
    ) {
        List<ReminderResponse> reminders = reminderService.list(userId, status, channel);
        audit("reminder.list.viewed", "User %s listed %d reminders".formatted(displayUser(userId, userEmail), reminders.size()), userId, userEmail)
                .detail("statusFilter", status)
                .detail("channelFilter", channel)
                .detail("resultCount", reminders.size())
                .log();
        return reminders;
    }

    @GetMapping("/{id}")
    ReminderResponse get(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @PathVariable UUID id
    ) {
        ReminderResponse response = reminderService.get(userId, id);
        audit("reminder.viewed", "User %s viewed reminder %s".formatted(displayUser(userId, userEmail), id), userId, userEmail)
                .resource("reminder", response.id())
                .detail("status", response.status())
                .detail("channel", response.channel())
                .log();
        return response;
    }

    @PutMapping("/{id}")
    ReminderResponse update(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateReminderRequest request
    ) {
        ReminderResponse response = reminderService.update(userId, id, request);
        audit("reminder.updated", "User %s updated reminder %s".formatted(displayUser(userId, userEmail), response.id()), userId, userEmail)
                .resource("reminder", response.id())
                .detail("title", response.title())
                .detail("channel", response.channel())
                .detail("recipient", response.recipient())
                .detail("scheduledFor", response.scheduledFor())
                .log();
        return response;
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @PathVariable UUID id
    ) {
        reminderService.delete(userId, id);
        audit("reminder.deleted", "User %s deleted reminder %s".formatted(displayUser(userId, userEmail), id), userId, userEmail)
                .resource("reminder", id)
                .log();
    }

    private AuditLogger.Builder audit(String action, String message, UUID userId, String userEmail) {
        return AuditLogger.event(LOGGER, action, message)
                .category("reminder")
                .user(userId, userEmail);
    }

    private String displayUser(UUID userId, String userEmail) {
        return userEmail == null || userEmail.isBlank() ? userId.toString() : userEmail;
    }
}
