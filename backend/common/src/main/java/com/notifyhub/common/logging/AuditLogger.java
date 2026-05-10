package com.notifyhub.common.logging;

import org.slf4j.Logger;

import java.time.Instant;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.UUID;

public final class AuditLogger {

    private static final String PREFIX = "notifyhub_audit ";

    private AuditLogger() {
    }

    public static Builder event(Logger logger, String action, String message) {
        return new Builder(logger, action, message);
    }

    public static final class Builder {

        private final Logger logger;
        private final String message;
        private final Map<String, Object> event = new LinkedHashMap<>();
        private final Map<String, Object> user = new LinkedHashMap<>();
        private final Map<String, Object> resource = new LinkedHashMap<>();
        private final Map<String, Object> notifyhub = new LinkedHashMap<>();

        private Builder(Logger logger, String action, String message) {
            this.logger = logger;
            this.message = message;
            event.put("kind", "event");
            event.put("category", "audit");
            event.put("type", "info");
            event.put("action", action);
            event.put("outcome", "success");
            notifyhub.put("audit", true);
        }

        public Builder category(String category) {
            putIfPresent(event, "category", category);
            return this;
        }

        public Builder outcome(String outcome) {
            putIfPresent(event, "outcome", outcome);
            return this;
        }

        public Builder user(UUID userId, String email) {
            putIfPresent(user, "id", userId);
            putIfPresent(user, "email", email);
            return this;
        }

        public Builder resource(String type, Object id) {
            putIfPresent(resource, "type", type);
            putIfPresent(resource, "id", id);
            return this;
        }

        public Builder detail(String key, Object value) {
            putIfPresent(notifyhub, key, value);
            return this;
        }

        public void log() {
            if (logger.isInfoEnabled()) {
                logger.info("{}{}", PREFIX, toJson());
            }
        }

        private String toJson() {
            StringBuilder json = new StringBuilder("{");
            boolean first = appendField(json, true, "message", message);
            first = appendObject(json, first, "event", event);
            first = appendObject(json, first, "user", user);
            first = appendObject(json, first, "resource", resource);
            appendObject(json, first, "notifyhub", notifyhub);
            json.append('}');
            return json.toString();
        }
    }

    private static void putIfPresent(Map<String, Object> values, String key, Object value) {
        if (value == null) {
            return;
        }
        if (value instanceof String text && text.isBlank()) {
            return;
        }
        values.put(key, value);
    }

    private static boolean appendObject(
            StringBuilder json,
            boolean first,
            String key,
            Map<String, Object> values
    ) {
        if (values.isEmpty()) {
            return first;
        }

        first = appendName(json, first, key);
        json.append('{');
        boolean objectFirst = true;
        for (Map.Entry<String, Object> entry : values.entrySet()) {
            objectFirst = appendField(json, objectFirst, entry.getKey(), entry.getValue());
        }
        json.append('}');
        return false;
    }

    private static boolean appendField(StringBuilder json, boolean first, String key, Object value) {
        first = appendName(json, first, key);
        appendValue(json, value);
        return false;
    }

    private static boolean appendName(StringBuilder json, boolean first, String key) {
        if (!first) {
            json.append(',');
        }
        appendString(json, key);
        json.append(':');
        return false;
    }

    private static void appendValue(StringBuilder json, Object value) {
        if (value instanceof Number || value instanceof Boolean) {
            json.append(value);
            return;
        }

        if (value instanceof Enum<?> enumValue) {
            appendString(json, enumValue.name());
            return;
        }

        if (value instanceof Instant instant) {
            appendString(json, instant.toString());
            return;
        }

        appendString(json, String.valueOf(value));
    }

    private static void appendString(StringBuilder json, String value) {
        json.append('"');
        for (int index = 0; index < value.length(); index++) {
            char character = value.charAt(index);
            switch (character) {
                case '"' -> json.append("\\\"");
                case '\\' -> json.append("\\\\");
                case '\b' -> json.append("\\b");
                case '\f' -> json.append("\\f");
                case '\n' -> json.append("\\n");
                case '\r' -> json.append("\\r");
                case '\t' -> json.append("\\t");
                default -> {
                    if (character < 0x20) {
                        json.append("\\u%04x".formatted((int) character));
                    } else {
                        json.append(character);
                    }
                }
            }
        }
        json.append('"');
    }
}
