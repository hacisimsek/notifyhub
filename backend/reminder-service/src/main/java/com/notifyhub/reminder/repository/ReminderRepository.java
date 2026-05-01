package com.notifyhub.reminder.repository;

import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import org.springframework.data.jpa.repository.JpaRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    List<Reminder> findByOwnerIdOrderByScheduledForAsc(UUID ownerId);

    Optional<Reminder> findByIdAndOwnerId(UUID id, UUID ownerId);

    List<Reminder> findTop50ByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
            ReminderStatus status,
            Instant scheduledFor
    );
}
