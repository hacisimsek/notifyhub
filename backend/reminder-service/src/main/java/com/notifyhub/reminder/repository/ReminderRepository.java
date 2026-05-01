package com.notifyhub.reminder.repository;

import com.notifyhub.reminder.domain.Reminder;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface ReminderRepository extends JpaRepository<Reminder, UUID> {

    List<Reminder> findByOwnerIdOrderByScheduledForAsc(UUID ownerId);

    Optional<Reminder> findByIdAndOwnerId(UUID id, UUID ownerId);
}
