package com.notifyhub.reminder.repository;

import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.QueryHints;

import java.time.Instant;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Write model access: loads {@link Reminder} aggregates for commands and the trigger scheduler.
 * API reads go through {@link ReminderQueryRepository}.
 */
public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    Optional<Reminder> findByIdAndOwnerId(UUID id, UUID ownerId);

    // lock.timeout -2 = SKIP LOCKED, so concurrent schedulers never trigger the same reminder twice.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    List<Reminder> findTop50ByStatusAndScheduledForLessThanEqualOrderByScheduledForAsc(
            ReminderStatus status,
            Instant scheduledFor
    );
}
