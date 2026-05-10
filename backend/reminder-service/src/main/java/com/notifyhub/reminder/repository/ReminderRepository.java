package com.notifyhub.reminder.repository;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
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
            @Param("channel") NotificationChannel channel
    );

    Optional<Reminder> findByIdAndOwnerId(UUID id, UUID ownerId);

    List<Reminder> findTop50ByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
            ReminderStatus status,
            Instant scheduledFor
    );
}
