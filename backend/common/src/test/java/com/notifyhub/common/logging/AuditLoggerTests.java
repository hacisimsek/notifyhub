package com.notifyhub.common.logging;

import org.junit.jupiter.api.Test;

import static org.assertj.core.api.Assertions.assertThat;

class AuditLoggerTests {

    @Test
    void masksEmailLocalPartButKeepsDomain() {
        assertThat(AuditLogger.maskRecipient("jane.doe@example.com")).isEqualTo("j***@example.com");
    }

    @Test
    void masksPhoneNumbersToLastFourDigits() {
        assertThat(AuditLogger.maskRecipient("+905551112233")).isEqualTo("***2233");
        assertThat(AuditLogger.maskRecipient("123")).isEqualTo("***");
    }

    @Test
    void leavesMissingRecipientUntouched() {
        assertThat(AuditLogger.maskRecipient(null)).isNull();
    }
}
