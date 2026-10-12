package com.notifyhub.notification.delivery;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.domain.NotificationDeliveryAttempt;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationDeliveryAttemptRepository;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.stereotype.Service;

import java.util.List;

@Service
class NotificationDeliveryAttemptRecorder {

    private static final List<DeliveryStatus> RECORDED_STATUSES =
            List.of(DeliveryStatus.SENT, DeliveryStatus.RETRYING, DeliveryStatus.FAILED);

    private final NotificationDeliveryAttemptRepository notificationDeliveryAttemptRepository;
    private final MeterRegistry meterRegistry;

    NotificationDeliveryAttemptRecorder(
            NotificationDeliveryAttemptRepository notificationDeliveryAttemptRepository,
            MeterRegistry meterRegistry
    ) {
        this.notificationDeliveryAttemptRepository = notificationDeliveryAttemptRepository;
        this.meterRegistry = meterRegistry;
        // Register every channel/result pair up front so dashboards show SMS and PUSH at zero before first use.
        for (NotificationChannel channel : NotificationChannel.values()) {
            for (DeliveryStatus status : RECORDED_STATUSES) {
                counter(channel, status);
            }
        }
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
        recordMetric(notificationLog, status);
    }

    private void recordMetric(NotificationLog notificationLog, DeliveryStatus status) {
        counter(notificationLog.getChannel(), status).increment();
    }

    private Counter counter(NotificationChannel channel, DeliveryStatus status) {
        return Counter.builder("notifyhub.notification.delivery.attempts")
                .description("Notification delivery attempts by channel and result status")
                .tag("channel", channel.name())
                .tag("status", status.name())
                .register(meterRegistry);
    }
}
