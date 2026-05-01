package com.notifyhub.notification.delivery;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "true")
class RabbitNotificationDeliveryWorker {

    private final NotificationLogRepository notificationLogRepository;
    private final NotificationSender notificationSender;
    private final NotificationRabbitProperties properties;
    private final RabbitNotificationDeliveryPublisher publisher;

    RabbitNotificationDeliveryWorker(
            NotificationLogRepository notificationLogRepository,
            NotificationSender notificationSender,
            NotificationRabbitProperties properties,
            RabbitNotificationDeliveryPublisher publisher
    ) {
        this.notificationLogRepository = notificationLogRepository;
        this.notificationSender = notificationSender;
        this.properties = properties;
        this.publisher = publisher;
    }

    @Transactional
    public void deliver(NotificationDeliveryWork work) {
        NotificationLog notificationLog = notificationLogRepository.findById(work.notificationId())
                .orElseThrow(() -> new IllegalArgumentException("Notification log not found: " + work.notificationId()));

        if (notificationLog.getStatus() == DeliveryStatus.SENT) {
            return;
        }

        NotificationSender.DeliveryResult result = notificationSender.send(notificationLog);
        if (result.sent()) {
            notificationLog.markSent();
            return;
        }

        String failureReason = normalizeFailureReason(result.failureReason());
        if (work.attempt() < properties.getMaxAttempts()) {
            notificationLog.markRetrying(failureReason);
            publisher.publishRetry(work.nextAttempt());
            return;
        }

        notificationLog.markFailed(failureReason);
        publisher.publishDeadLetter(work);
    }

    private String normalizeFailureReason(String failureReason) {
        return failureReason == null || failureReason.isBlank()
                ? "Notification delivery failed"
                : failureReason.trim();
    }
}
