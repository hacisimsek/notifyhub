package com.notifyhub.reminder.repository;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.QueryHints;
import org.springframework.data.repository.query.Param;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    @Query("""
            select reminder
            from Reminder reminder
            where reminder.ownerId = :ownerId
              and (:status is null or reminder.status = :status)
              and (:channel is null or reminder.channel = :channel)
            order by reminder.createdAt desc
            """)
    List<Reminder> findOwnerReminders(
            @Param("ownerId") UUID ownerId,
            @Param("status") ReminderStatus status,
            @Param("channel") NotificationChannel channel,
            Pageable pageable
    );

    Optional<Reminder> findByIdAndOwnerId(UUID id, UUID ownerId);

    // lock.timeout -2 = SKIP LOCKED, so concurrent schedulers never trigger the same reminder twice.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    List<Reminder> findTop50ByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
            ReminderStatus status,
            Instant scheduledFor
    );
}
