package com.notifyhub.reminder.repository;

import com.notifyhub.reminder.domain.ReminderOutboxEvent;
import jakarta.persistence.LockModeType;
import jakarta.persistence.QueryHint;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.QueryHints;

import java.util.List;
import java.util.UUID;

public interface ReminderOutboxEventRepository extends JpaRepository<ReminderOutboxEvent, UUID> {

    // lock.timeout -2 = SKIP LOCKED, so concurrent publishers never send the same event twice.
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @QueryHints(@QueryHint(name = "jakarta.persistence.lock.timeout", value = "-2"))
    List<ReminderOutboxEvent> findTop50ByPublishedAtIsNullOrderByCreatedAtAsc();
}
