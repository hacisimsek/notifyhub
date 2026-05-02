package com.notifyhub.notification.delivery;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.notification.domain.NotificationDeliveryAttempt;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationDeliveryAttemptRepository;
import org.springframework.stereotype.Service;

@Service
class NotificationDeliveryAttemptRecorder {

    private final NotificationDeliveryAttemptRepository notificationDeliveryAttemptRepository;

    NotificationDeliveryAttemptRecorder(NotificationDeliveryAttemptRepository notificationDeliveryAttemptRepository) {
        this.notificationDeliveryAttemptRepository = notificationDeliveryAttemptRepository;
    }

    void record(
            NotificationLog notificationLog,
            int attemptNumber,
            DeliveryStatus status,
            String failureReason
    ) {
        if (notificationLog.getId() == null) {
            throw new IllegalStateException("Notification log must be persisted before recording delivery attempts");
        }

        NotificationDeliveryAttempt attempt = NotificationDeliveryAttempt.create(
                notificationLog.getId(),
                attemptNumber,
                status,
                failureReason
        );

        notificationDeliveryAttemptRepository.save(attempt);
        notificationLog.recordDeliveryAttempt(attempt.getAttemptedAt());
    }
}
