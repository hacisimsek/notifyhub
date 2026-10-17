package com.notifyhub.reminder.repository;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.api.ReminderResponse;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Read model queries for the reminder API. Extends the plain {@link Repository} marker so no save or delete
 * methods are exposed.
 */
public interface ReminderQueryRepository extends Repository<Reminder, UUID> {

    @Query("""
            select new com.notifyhub.reminder.api.ReminderResponse(
                reminder.id, reminder.ownerId, reminder.title, reminder.message, reminder.scheduledFor,
                reminder.channel, reminder.recipient, reminder.status, reminder.createdAt, reminder.updatedAt)
            from Reminder reminder
            where reminder.ownerId = :ownerId
              and (:status is null or reminder.status = :status)
              and (:channel is null or reminder.channel = :channel)
            order by reminder.createdAt desc
            """)
    List<ReminderResponse> findOwnerReminders(
            @Param("ownerId") UUID ownerId,
            @Param("status") ReminderStatus status,
            @Param("channel") NotificationChannel channel,
            Pageable pageable
    );

    @Query("""
            select new com.notifyhub.reminder.api.ReminderResponse(
                reminder.id, reminder.ownerId, reminder.title, reminder.message, reminder.scheduledFor,
                reminder.channel, reminder.recipient, reminder.status, reminder.createdAt, reminder.updatedAt)
            from Reminder reminder
            where reminder.id = :id
              and reminder.ownerId = :ownerId
            """)
    Optional<ReminderResponse> findOwnerReminder(@Param("ownerId") UUID ownerId, @Param("id") UUID id);
}
