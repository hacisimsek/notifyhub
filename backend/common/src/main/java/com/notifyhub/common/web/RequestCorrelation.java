package com.notifyhub.common.web;

import org.slf4j.MDC;

import java.util.Optional;
import java.util.UUID;
import java.util.function.Supplier;
import java.util.regex.Pattern;

public final class RequestCorrelation {

    public static final String HEADER = "X-Request-Id";
    public static final String MDC_KEY = "request.id";

    private static final Pattern SAFE_REQUEST_ID = Pattern.compile("[A-Za-z0-9._:-]{1,128}");

    private RequestCorrelation() {
    }

    public static String resolve(String requestId) {
        if (requestId == null) {
            return newRequestId();
        }

        String normalized = requestId.trim();
        if (normalized.isEmpty() || !SAFE_REQUEST_ID.matcher(normalized).matches()) {
            return newRequestId();
        }
        return normalized;
    }

    public static Optional<String> currentRequestId() {
        return Optional.ofNullable(MDC.get(MDC_KEY))
                .filter(value -> !value.isBlank());
    }

    /**
     * Runs work outside an HTTP request (scheduler, Kafka or RabbitMQ listener) under the request id that started
     * the flow, so its audit logs share one {@code request.id}. A missing or unsafe id is replaced with a new one.
     */
    public static <T> T callWith(String requestId, Supplier<T> work) {
        String previous = MDC.get(MDC_KEY);
        MDC.put(MDC_KEY, resolve(requestId));
        try {
            return work.get();
        } finally {
            if (previous == null) {
                MDC.remove(MDC_KEY);
            } else {
                MDC.put(MDC_KEY, previous);
            }
        }
    }

    public static void runWith(String requestId, Runnable work) {
        callWith(requestId, () -> {
            work.run();
            return null;
        });
    }

    private static String newRequestId() {
        return UUID.randomUUID().toString();
    }
}
