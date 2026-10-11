package com.notifyhub.notification.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.notification.api.CreateNotificationRequest;
import com.notifyhub.notification.api.NotificationResponse;
import com.notifyhub.notification.service.NotificationService;
import org.springframework.stereotype.Service;
import org.springframework.util.StringUtils;

@Service
public class ReminderTriggeredEventHandler {

    private final NotificationService notificationService;

    public ReminderTriggeredEventHandler(NotificationService notificationService) {
        this.notificationService = notificationService;
    }

    public NotificationResponse handle(ReminderTriggeredEvent event) {
        return notificationService.createAndDispatch(new CreateNotificationRequest(
                event.userId(),
                event.reminderId(),
                event.channel(),
                event.recipient(),
                event.title(),
                // Reminder messages are optional, but a notification needs a body.
                StringUtils.hasText(event.message()) ? event.message() : event.title(),
                event.idempotencyKey()
        ));
    }
}
