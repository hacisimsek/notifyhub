package com.notifyhub.notification.api;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.service.NotificationService;
import jakarta.validation.Valid;
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
            @RequestParam(required = false) DeliveryStatus status,
            @RequestParam(required = false) NotificationChannel channel
    ) {
        return notificationService.list(userId, status, channel);
    }
}
