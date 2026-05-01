package com.notifyhub.notification.delivery;

import com.notifyhub.notification.domain.NotificationLog;

public interface NotificationDeliveryDispatcher {

    NotificationLog dispatch(NotificationLog notificationLog);
}
