package com.notifyhub.notification.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;
import com.notifyhub.notification.api.CreateNotificationRequest;
import com.notifyhub.notification.api.NotificationResponse;
import com.notifyhub.notification.service.NotificationService;
import org.springframework.stereotype.Service;

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
                event.message(),
                event.idempotencyKey()
        ));
    }
}
