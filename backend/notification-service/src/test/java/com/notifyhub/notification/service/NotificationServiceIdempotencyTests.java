package com.notifyhub.notification.service;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.api.CreateNotificationRequest;
import com.notifyhub.notification.api.NotificationResponse;
import com.notifyhub.notification.delivery.NotificationDeliveryDispatcher;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.dao.DataIntegrityViolationException;
import org.springframework.transaction.PlatformTransactionManager;

import java.util.Optional;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class NotificationServiceIdempotencyTests {

    private static final String IDEMPOTENCY_KEY = "reminder:1:2026-05-02T09:00:00Z";

    @Mock
    private NotificationLogRepository notificationLogRepository;

    @Mock
    private NotificationDeliveryDispatcher notificationDeliveryDispatcher;

    @Mock
    private PlatformTransactionManager transactionManager;

    @Test
    void concurrentDuplicateReturnsTheNotificationThatWonTheRace() {
        NotificationLog winner = new NotificationLog(
                UUID.randomUUID(), UUID.randomUUID(), NotificationChannel.EMAIL,
                "user@example.com", "Invoice due", "Invoice is due tomorrow", IDEMPOTENCY_KEY
        );
        when(notificationLogRepository.findByIdempotencyKey(IDEMPOTENCY_KEY))
                .thenReturn(Optional.empty())
                .thenReturn(Optional.of(winner));
        when(notificationLogRepository.saveAndFlush(any(NotificationLog.class)))
                .thenThrow(new DataIntegrityViolationException("duplicate idempotency_key"));
        NotificationService service = new NotificationService(
                notificationLogRepository, notificationDeliveryDispatcher, transactionManager
        );

        NotificationResponse response = service.createAndDispatch(new CreateNotificationRequest(
                winner.getUserId(), winner.getReminderId(), NotificationChannel.EMAIL,
                "user@example.com", "Invoice due", "Invoice is due tomorrow", IDEMPOTENCY_KEY
        ));

        assertThat(response.idempotencyKey()).isEqualTo(IDEMPOTENCY_KEY);
        verifyNoInteractions(notificationDeliveryDispatcher);
    }
}
