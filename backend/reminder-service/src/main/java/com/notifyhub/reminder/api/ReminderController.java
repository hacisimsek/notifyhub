package com.notifyhub.reminder.api;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.service.ReminderService;
import jakarta.validation.Valid;
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

    private final ReminderService reminderService;

    ReminderController(ReminderService reminderService) {
        this.reminderService = reminderService;
    }

    @PostMapping
    @ResponseStatus(HttpStatus.CREATED)
    ReminderResponse create(
            @RequestHeader("X-User-Id") UUID userId,
            @Valid @RequestBody CreateReminderRequest request
    ) {
        return reminderService.create(userId, request);
    }

    @GetMapping
    List<ReminderResponse> list(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestParam(required = false) ReminderStatus status,
            @RequestParam(required = false) NotificationChannel channel
    ) {
        return reminderService.list(userId, status, channel);
    }

    @GetMapping("/{id}")
    ReminderResponse get(@RequestHeader("X-User-Id") UUID userId, @PathVariable UUID id) {
        return reminderService.get(userId, id);
    }

    @PutMapping("/{id}")
    ReminderResponse update(
            @RequestHeader("X-User-Id") UUID userId,
            @PathVariable UUID id,
            @Valid @RequestBody UpdateReminderRequest request
    ) {
        return reminderService.update(userId, id, request);
    }

    @DeleteMapping("/{id}")
    @ResponseStatus(HttpStatus.NO_CONTENT)
    void delete(@RequestHeader("X-User-Id") UUID userId, @PathVariable UUID id) {
        reminderService.delete(userId, id);
    }
}
