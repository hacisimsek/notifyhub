package com.notifyhub.notification.service;

import com.notifyhub.common.logging.AuditLogger;
import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.api.CreateNotificationRequest;
import com.notifyhub.notification.api.NotificationResponse;
import com.notifyhub.notification.delivery.NotificationDeliveryDispatcher;
import com.notifyhub.notification.domain.NotificationLog;
import com.notifyhub.notification.repository.NotificationLogRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.util.StringUtils;

import java.util.List;
import java.util.Locale;
import java.util.UUID;

@Service
public class NotificationService {

    private static final Logger LOGGER = LoggerFactory.getLogger(NotificationService.class);

    private final NotificationLogRepository notificationLogRepository;
    private final NotificationDeliveryDispatcher notificationDeliveryDispatcher;

    public NotificationService(
            NotificationLogRepository notificationLogRepository,
            NotificationDeliveryDispatcher notificationDeliveryDispatcher
    ) {
        this.notificationLogRepository = notificationLogRepository;
        this.notificationDeliveryDispatcher = notificationDeliveryDispatcher;
    }

    @Transactional
    public NotificationResponse createAndDispatch(CreateNotificationRequest request) {
        if (StringUtils.hasText(request.idempotencyKey())) {
            return notificationLogRepository.findByIdempotencyKey(request.idempotencyKey())
                    .map(existingLog -> {
                        audit("notification.idempotency.reused", "Notification %s reused for idempotency key".formatted(existingLog.getId()), existingLog)
                                .detail("idempotencyKey", existingLog.getIdempotencyKey())
                                .log();
                        return NotificationResponse.from(existingLog);
                    })
                    .orElseGet(() -> createNewNotification(request));
        }

        return createNewNotification(request);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(UUID userId) {
        return list(userId, null, null);
    }

    @Transactional(readOnly = true)
    public List<NotificationResponse> list(UUID userId, DeliveryStatus status, NotificationChannel channel) {
        return notificationLogRepository.findUserHistory(userId, status, channel)
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

        NotificationLog dispatchedLog = notificationDeliveryDispatcher.dispatch(log);
        audit("notification.created", "Notification %s created for user %s".formatted(
                        dispatchedLog.getId(),
                        dispatchedLog.getUserId()
                ), dispatchedLog)
                .detail("status", dispatchedLog.getStatus())
                .detail("idempotencyKey", dispatchedLog.getIdempotencyKey())
                .log();
        return NotificationResponse.from(dispatchedLog);
    }

    private AuditLogger.Builder audit(String action, String message, NotificationLog log) {
        return AuditLogger.event(LOGGER, action, message)
                .category("notification")
                .user(log.getUserId(), null)
                .resource("notification", log.getId())
                .detail("reminderId", log.getReminderId())
                .detail("channel", log.getChannel())
                .detail("recipient", log.getRecipient());
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
