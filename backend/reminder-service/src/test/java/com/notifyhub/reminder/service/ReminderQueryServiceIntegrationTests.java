package com.notifyhub.reminder.service;

import com.notifyhub.common.notifications.NotificationChannel;
import com.notifyhub.reminder.api.ReminderResponse;
import com.notifyhub.reminder.domain.Reminder;
import com.notifyhub.reminder.domain.ReminderStatus;
import com.notifyhub.reminder.repository.ReminderRepository;
import jakarta.persistence.EntityManager;
import org.hibernate.Session;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.data.domain.Pageable;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.support.TransactionTemplate;
import org.springframework.web.server.ResponseStatusException;

import java.time.Instant;
import java.util.List;
import java.util.UUID;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

@ActiveProfiles("test")
@SpringBootTest
class ReminderQueryServiceIntegrationTests {

    private static final UUID USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25c11");
    private static final UUID OTHER_USER_ID = UUID.fromString("018f1757-0aa5-7a6a-9a33-e78995f25c12");

    @Autowired
    private ReminderQueryService queryService;

    @Autowired
    private ReminderRepository reminderRepository;

    @Autowired
    private EntityManager entityManager;

    @Autowired
    private TransactionTemplate transactionTemplate;

    private Reminder reminder;

    @BeforeEach
    void seedReminder() {
        reminderRepository.deleteAll();
        reminder = reminderRepository.save(new Reminder(
                USER_ID,
                "Pay invoice",
                "Due tomorrow",
                Instant.now().plusSeconds(3600),
                NotificationChannel.EMAIL,
                "user@example.com"
        ));
    }

    @Test
    void queriesProjectIntoReadModelWithoutLoadingEntities() {
        transactionTemplate.executeWithoutResult(status -> {
            List<ReminderResponse> reminders = queryService.list(USER_ID, null, null, Pageable.unpaged());
            ReminderResponse single = queryService.get(USER_ID, reminder.getId());

            assertThat(reminders).extracting(ReminderResponse::title).containsExactly("Pay invoice");
            assertThat(single.status()).isEqualTo(ReminderStatus.SCHEDULED);
            assertThat(managedEntityCount()).isZero();

            // Control: the write-side repository does load the aggregate into the persistence context.
            reminderRepository.findByIdAndOwnerId(reminder.getId(), USER_ID);
            assertThat(managedEntityCount()).isEqualTo(1);
        });
    }

    @Test
    void readModelIsScopedToOwner() {
        assertThat(queryService.list(OTHER_USER_ID, null, null, Pageable.unpaged())).isEmpty();
        assertThatThrownBy(() -> queryService.get(OTHER_USER_ID, reminder.getId()))
                .isInstanceOf(ResponseStatusException.class)
                .hasMessageContaining("Reminder not found");
    }

    private int managedEntityCount() {
        return entityManager.unwrap(Session.class).getStatistics().getEntityCount();
    }
}
