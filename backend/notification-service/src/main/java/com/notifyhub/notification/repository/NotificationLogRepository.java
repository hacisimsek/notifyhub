package com.notifyhub.notification.repository;

import com.notifyhub.notification.domain.NotificationLog;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface NotificationLogRepository extends JpaRepository<NotificationLog, UUID> {

    List<NotificationLog> findByUserIdOrderByCreatedAtDesc(UUID userId);

    Optional<NotificationLog> findByIdempotencyKey(String idempotencyKey);
}
