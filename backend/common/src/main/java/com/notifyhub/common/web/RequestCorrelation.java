package com.notifyhub.common.web;

import org.slf4j.MDC;

import java.util.Optional;
import java.util.UUID;
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

    private static String newRequestId() {
        return UUID.randomUUID().toString();
    }
}
