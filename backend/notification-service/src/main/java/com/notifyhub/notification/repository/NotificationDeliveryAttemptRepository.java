package com.notifyhub.notification.repository;

import com.notifyhub.notification.domain.NotificationDeliveryAttempt;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.UUID;

public interface NotificationDeliveryAttemptRepository extends JpaRepository<NotificationDeliveryAttempt, UUID> {

    List<NotificationDeliveryAttempt> findByNotificationLogIdOrderByAttemptedAtAsc(UUID notificationLogId);
}
