package com.notifyhub.notification.api;

import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.service.NotificationService;
import jakarta.validation.Valid;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import java.util.List;
import java.util.UUID;

@RestController
class NotificationController {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationController.class);

    private final NotificationService notificationService;

    NotificationController(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    @PostMapping("/internal/notifications")
    @ResponseStatus(HttpStatus.CREATED)
    NotificationResponse create(@Valid @RequestBody CreateNotificationRequest request) {
        return notificationService.createAndDispatch(request);
    }

    @GetMapping("/api/notifications")
    List<NotificationResponse> list(
            @RequestHeader("X-User-Id") UUID userId,
            @RequestHeader(value = "X-User-Email", required = false) String userEmail,
            @RequestParam(required = false) DeliveryStatus status,
            @RequestParam(required = false) NotificationChannel channel
    ) {
        List<NotificationResponse> notifications = notificationService.list(userId, status, channel);
        AuditLogger.event(LOGGER, "notification.history.viewed", "User %s viewed %d notifications".formatted(
                        displayUser(userId, userEmail),
                        notifications.size()
                ))
                .category("notification")
                .user(userId, userEmail)
                .detail("statusFilter", status)
                .detail("channelFilter", channel)
                .detail("resultCount", notifications.size())
                .log();
        return notifications;
    }

    private String displayUser(UUID userId, String userEmail) {
        return userEmail == null || userEmail.isBlank() ? userId.toString() : userEmail;
    }
}
