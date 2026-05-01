package com.notifyhub.notification.service;

import com.notifyhub.notification.api.CreateNotificationRequest;
import com.notifyhub.notification.api.NotificationResponse;
import com.notifyhub.notification.delivery.NotificationSender;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class NotificationService {

    private final NotificationLogRepository notificationLogRepository;
    private final NotificationSender notificationSender;

    public NotificationService(
            NotificationLogRepository notificationLogRepository,
            NotificationSender notificationSender
    ) {
        this.notificationLogRepository = notificationLogRepository;
        this.notificationSender = notificationSender;
    }

    @Transactional
    public NotificationResponse createAndDispatch(CreateNotificationRequest request) {
        if (StringUtils.hasText(request.idempotencyKey())) {
            return notificationLogRepository.findByIdempotencyKey(request.idempotencyKey())
                    .map(NotificationResponse::from)
                    .orElseGet(() -> createNewNotification(request));
        }

        return createNewNotification(request);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(UUID userId) {
        return notificationLogRepository.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(NotificationResponse::from)
                .toList();
    }

    private NotificationResponse createNewNotification(CreateNotificationRequest request) {
        NotificationLog log = notificationLogRepository.save(new NotificationLog(
                request.userId(),
                request.reminderId(),
                request.channel(),
                normalizeRecipient(request),
                request.subject().trim(),
                request.message().trim(),
                normalizeIdempotencyKey(request.idempotencyKey())
        ));

        NotificationSender.DeliveryResult result = notificationSender.send(log);
        if (result.sent()) {
            log.markSent();
        } else {
            log.markFailed(result.failureReason());
        }

        return NotificationResponse.from(log);
    }

    private String normalizeIdempotencyKey(String idempotencyKey) {
        return StringUtils.hasText(idempotencyKey) ? idempotencyKey.trim() : null;
    }

    private String normalizeRecipient(CreateNotificationRequest request) {
        String recipient = request.recipient().trim();
        return switch (request.channel()) {
            case EMAIL -> recipient.toLowerCase(Locale.ROOT);
            case SMS, PUSH -> recipient;
        };
    }
}
