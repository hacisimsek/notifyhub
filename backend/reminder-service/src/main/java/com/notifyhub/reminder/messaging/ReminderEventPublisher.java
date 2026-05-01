package com.notifyhub.reminder.messaging;

import com.notifyhub.common.events.ReminderTriggeredEvent;

public interface ReminderEventPublisher {

    void publish(ReminderTriggeredEvent event);
}
