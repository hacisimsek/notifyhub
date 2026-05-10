package com.notifyhub.notification.delivery;

import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

@Service
@ConditionalOnProperty(prefix = "notifyhub.delivery.rabbitmq", name = "enabled", havingValue = "true")
class RabbitNotificationDeliveryWorker {

    private static final Logger LOGGER = LoggerFactory.getLogger(RabbitNotificationDeliveryWorker.class);

    private final NotificationLogRepository notificationLogRepository;
    private final NotificationSender notificationSender;
    private final NotificationDeliveryAttemptRecorder attemptRecorder;
    private final NotificationRabbitProperties properties;
    private final RabbitNotificationDeliveryPublisher publisher;

    RabbitNotificationDeliveryWorker(
            NotificationLogRepository notificationLogRepository,
            NotificationSender notificationSender,
            NotificationDeliveryAttemptRecorder attemptRecorder,
            NotificationRabbitProperties properties,
            RabbitNotificationDeliveryPublisher publisher
    ) {
        this.notificationLogRepository = notificationLogRepository;
        this.notificationSender = notificationSender;
        this.attemptRecorder = attemptRecorder;
        this.properties = properties;
        this.publisher = publisher;
    }

    @Transactional
    public void deliver(NotificationDeliveryWork work) {
        NotificationLog notificationLog = notificationLogRepository.findById(work.notificationId())
                .orElseThrow(() -> new IllegalArgumentException("Notification log not found: " + work.notificationId()));

        if (notificationLog.getStatus() == DeliveryStatus.SENT) {
            audit("notification.delivery.skipped", "Notification %s delivery skipped because it is already sent".formatted(
                            notificationLog.getId()
                    ), notificationLog, work.attempt())
                    .detail("status", notificationLog.getStatus())
                    .log();
            return;
        }

        NotificationSender.DeliveryResult result = notificationSender.send(notificationLog);
        if (result.sent()) {
            notificationLog.markSent();
            attemptRecorder.record(notificationLog, work.attempt(), DeliveryStatus.SENT, null);
            audit("notification.delivery.sent", "Notification %s sent to %s via %s".formatted(
                            notificationLog.getId(),
                            notificationLog.getRecipient(),
                            notificationLog.getChannel()
                    ), notificationLog, work.attempt())
                    .detail("status", DeliveryStatus.SENT)
                    .log();
            return;
        }

        String failureReason = normalizeFailureReason(result.failureReason());
        if (work.attempt() < properties.getMaxAttempts()) {
            notificationLog.markRetrying(failureReason);
            attemptRecorder.record(notificationLog, work.attempt(), DeliveryStatus.RETRYING, failureReason);
            publisher.publishRetry(work.nextAttempt());
            audit("notification.delivery.retrying", "Notification %s delivery failed; retry %d scheduled".formatted(
                            notificationLog.getId(),
                            work.nextAttempt().attempt()
                    ), notificationLog, work.attempt())
                    .outcome("failure")
                    .detail("status", DeliveryStatus.RETRYING)
                    .detail("failureReason", failureReason)
                    .detail("nextAttempt", work.nextAttempt().attempt())
                    .log();
            return;
        }

        notificationLog.markFailed(failureReason);
        attemptRecorder.record(notificationLog, work.attempt(), DeliveryStatus.FAILED, failureReason);
        publisher.publishDeadLetter(work);
        audit("notification.delivery.failed", "Notification %s delivery failed permanently".formatted(notificationLog.getId()), notificationLog, work.attempt())
                .outcome("failure")
                .detail("status", DeliveryStatus.FAILED)
                .detail("failureReason", failureReason)
                .log();
    }

    private AuditLogger.Builder audit(String action, String message, NotificationLog notificationLog, int attempt) {
        return AuditLogger.event(LOGGER, action, message)
                .category("notification")
                .user(notificationLog.getUserId(), null)
                .resource("notification", notificationLog.getId())
                .detail("reminderId", notificationLog.getReminderId())
                .detail("channel", notificationLog.getChannel())
                .detail("recipient", notificationLog.getRecipient())
                .detail("attempt", attempt);
    }

    private String normalizeFailureReason(String failureReason) {
        return failureReason == null || failureReason.isBlank()
                ? "Notification delivery failed"
                : failureReason.trim();
    }
}
