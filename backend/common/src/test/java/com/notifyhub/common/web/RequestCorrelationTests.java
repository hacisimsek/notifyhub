package com.notifyhub.common.web;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.slf4j.MDC;

import static org.assertj.core.api.Assertions.assertThat;

class RequestCorrelationTests {

    @AfterEach
    void clearMdc() {
        MDC.clear();
    }

    @Test
    void callWithExposesRequestIdOnlyDuringWork() {
        String seen = RequestCorrelation.callWith("req-123", () -> RequestCorrelation.currentRequestId().orElseThrow());

        assertThat(seen).isEqualTo("req-123");
        assertThat(RequestCorrelation.currentRequestId()).isEmpty();
    }

    @Test
    void callWithRestoresTheOuterRequestId() {
        MDC.put(RequestCorrelation.MDC_KEY, "outer");

        RequestCorrelation.runWith("inner", () -> assertThat(RequestCorrelation.currentRequestId()).contains("inner"));

        assertThat(RequestCorrelation.currentRequestId()).contains("outer");
    }

    @Test
    void callWithGeneratesRequestIdWhenMissing() {
        String seen = RequestCorrelation.callWith(null, () -> RequestCorrelation.currentRequestId().orElseThrow());

        assertThat(seen).isNotBlank();
    }
}
