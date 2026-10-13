package com.notifyhub.gateway.config;

import org.junit.jupiter.api.Test;
import org.springframework.boot.context.properties.bind.Binder;
import org.springframework.boot.context.properties.source.MapConfigurationPropertySource;

import java.util.List;
import java.util.Map;

import static org.assertj.core.api.Assertions.assertThat;

class GatewayPropertiesTests {

    private static final String SECRET = "test-secret-with-enough-length-for-hmac-signing";

    @Test
    void commaSeparatedCorsOriginsAreTrimmedAndBlankEntriesDropped() {
        GatewayProperties properties = bind(Map.of(
                "notifyhub.gateway.jwt.secret", SECRET,
                "notifyhub.gateway.cors.allowed-origins", "http://a.test, http://b.test,,"
        ));

        assertThat(properties.cors().allowedOrigins()).containsExactly("http://a.test", "http://b.test");
    }

    @Test
    void missingCorsSettingAllowsNoOrigins() {
        GatewayProperties properties = bind(Map.of("notifyhub.gateway.jwt.secret", SECRET));

        assertThat(properties.cors().allowedOrigins()).isEmpty();
    }

    @Test
    void blankCorsSettingAllowsNoOrigins() {
        assertThat(new GatewayProperties.Cors(List.of(" ", "")).allowedOrigins()).isEmpty();
    }

    private GatewayProperties bind(Map<String, String> values) {
        return new Binder(new MapConfigurationPropertySource(values))
                .bind("notifyhub.gateway", GatewayProperties.class)
                .get();
    }
}
