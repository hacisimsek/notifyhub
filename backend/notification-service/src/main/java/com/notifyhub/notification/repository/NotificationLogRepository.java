package com.notifyhub.notification.repository;

import com.notifyhub.common.notifications.DeliveryStatus;
import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID> {

    List<NotificationLog> findByUserIdOrderByCreatedAtDesc(UUID userId);

    @Query("""
            select notificationLog
            from NotificationLog notificationLog
            where notificationLog.userId = :userId
              and (:status is null or notificationLog.status = :status)
              and (:channel is null or notificationLog.channel = :channel)
            order by notificationLog.createdAt desc
            """)
    List<NotificationLog> findUserHistory(
            @Param("userId") UUID userId,
            @Param("status") DeliveryStatus status,
            @Param("channel") NotificationChannel channel
    );

    Optional<NotificationLog> findByIdempotencyKey(String idempotencyKey);
}
