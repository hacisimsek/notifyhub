package com.notifyhub.gateway.i18n;

import java.util.Map;

record LanguageMessagesResponse(
        String language,
        Map<String, String> messages
) {
}
