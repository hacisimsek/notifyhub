package com.notifyhub.notification.delivery;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Component;

@Component
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "false", matchIfMissing = true)
class DirectNotificationDeliveryDispatcher implements NotificationDeliveryDispatcher {

    private final NotificationSender notificationSender;
    private final NotificationDeliveryAttemptRecorder attemptRecorder;

    DirectNotificationDeliveryDispatcher(
            NotificationSender notificationSender,
            NotificationDeliveryAttemptRecorder attemptRecorder
    ) {
        this.notificationSender = notificationSender;
        this.attemptRecorder = attemptRecorder;
    }

    @Override
    public NotificationLog dispatch(NotificationLog notificationLog) {
        NotificationSender.DeliveryResult result = notificationSender.send(notificationLog);
        if (result.sent()) {
            notificationLog.markSent();
            attemptRecorder.record(notificationLog, 1, DeliveryStatus.SENT, null);
        } else {
            String failureReason = normalizeFailureReason(result.failureReason());
            notificationLog.markFailed(failureReason);
            attemptRecorder.record(notificationLog, 1, DeliveryStatus.FAILED, failureReason);
        }

        return notificationLog;
    }

    private String normalizeFailureReason(String failureReason) {
        return failureReason == null || failureReason.isBlank()
                ? "Notification delivery failed"
                : failureReason.trim();
    }
}
