package com.notifyhub.notification.delivery;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class RabbitNotificationDeliveryWorkerTests {

    private static final UUID NOTIFICATION_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25c01");
    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25c02");

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private NotificationSender notificationSender;

    @Mock
    private NotificationDeliveryAttemptRecorder attemptRecorder;

    @Mock
    private RabbitNotificationDeliveryPublisher publisher;

    private RabbitNotificationDeliveryWorker worker;

    @BeforeEach
    void setUp() {
        NotificationRabbitProperties properties = new NotificationRabbitProperties();
        properties.setMaxAttempts(3);
        worker = new RabbitNotificationDeliveryWorker(
                notificationLogRepository,
                notificationSender,
                attemptRecorder,
                properties,
                publisher
        );
    }

    @Test
    void successfulDeliveryMarksNotificationSent() {
        NotificationLog notificationLog = notificationLog();
        when(notificationLogRepository.findById(NOTIFICATION_ID)).thenReturn(Optional.of(notificationLog));
        when(notificationSender.send(notificationLog)).thenReturn(NotificationSender.DeliveryResult.success());

        worker.deliver(NotificationDeliveryWork.firstAttempt(NOTIFICATION_ID));

        assertThat(notificationLog.getStatus()).isEqualTo(DeliveryStatus.SENT);
        assertThat(notificationLog.getSentAt()).isNotNull();
        verify(attemptRecorder).record(notificationLog, 1, DeliveryStatus.SENT, null);
        verifyNoInteractions(publisher);
    }

    @Test
    void failedDeliveryPublishesRetryWhenAttemptsRemain() {
        NotificationLog notificationLog = notificationLog();
        when(notificationLogRepository.findById(NOTIFICATION_ID)).thenReturn(Optional.of(notificationLog));
        when(notificationSender.send(notificationLog)).thenReturn(NotificationSender.DeliveryResult.failed("smtp unavailable"));

        worker.deliver(NotificationDeliveryWork.firstAttempt(NOTIFICATION_ID));

        assertThat(notificationLog.getStatus()).isEqualTo(DeliveryStatus.RETRYING);
        assertThat(notificationLog.getFailureReason()).isEqualTo("smtp unavailable");
        verify(attemptRecorder).record(notificationLog, 1, DeliveryStatus.RETRYING, "smtp unavailable");
        verify(publisher).publishRetry(new NotificationDeliveryWork(NOTIFICATION_ID, 2));
    }

    @Test
    void failedDeliveryPublishesDeadLetterWhenAttemptsAreExhausted() {
        NotificationLog notificationLog = notificationLog();
        NotificationDeliveryWork finalAttempt = new NotificationDeliveryWork(NOTIFICATION_ID, 3);
        when(notificationLogRepository.findById(NOTIFICATION_ID)).thenReturn(Optional.of(notificationLog));
        when(notificationSender.send(notificationLog)).thenReturn(NotificationSender.DeliveryResult.failed("provider rejected"));

        worker.deliver(finalAttempt);

        assertThat(notificationLog.getStatus()).isEqualTo(DeliveryStatus.FAILED);
        assertThat(notificationLog.getFailureReason()).isEqualTo("provider rejected");
        verify(attemptRecorder).record(notificationLog, 3, DeliveryStatus.FAILED, "provider rejected");
        verify(publisher).publishDeadLetter(finalAttempt);
    }

    private NotificationLog notificationLog() {
        return new NotificationLog(
                USER_ID,
                UUID.randomUUID(),
                NotificationChannel.EMAIL,
                "user@example.com",
                "Invoice due",
                "Invoice is due tomorrow",
                "invoice-due"
        );
    }
}
