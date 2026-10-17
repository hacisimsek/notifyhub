package com.notifyhub.gateway.config;

import com.notifyhub.gateway.security.SessionCookies;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.context.annotation.Bean;
import org.springframework.context.annotation.Configuration;
import org.springframework.http.HttpHeaders;
import org.springframework.web.client.RestClient;
import org.springframework.web.servlet.config.annotation.CorsRegistry;
import org.springframework.web.servlet.config.annotation.WebMvcConfigurer;

@Configuration
@EnableConfigurationProperties(GatewayProperties.class)
class GatewayConfig {

    private static final String REQUEST_ID_HEADER = "X-Request-Id";

    @Bean
    RestClient restClient(RestClient.Builder builder) {
        return builder.build();
    }

    /**
     * Only exact origins are allowed; credentials are enabled so a trusted origin can use the session cookie.
     * An empty list rejects every cross-origin request.
     */
    @Bean
    WebMvcConfigurer corsConfigurer(GatewayProperties properties) {
        return new WebMvcConfigurer() {
            @Override
            public void addCorsMappings(CorsRegistry registry) {
                registry.addMapping("/api/**")
                        .allowedOrigins(properties.cors().allowedOrigins().toArray(String[]::new))
                        .allowedMethods("GET", "POST", "PUT", "DELETE", "OPTIONS")
                        .allowedHeaders(
                                HttpHeaders.AUTHORIZATION,
                                HttpHeaders.CONTENT_TYPE,
                                HttpHeaders.ACCEPT,
                                HttpHeaders.ACCEPT_LANGUAGE,
                                REQUEST_ID_HEADER,
                                SessionCookies.CLIENT_HEADER)
                        .exposedHeaders(REQUEST_ID_HEADER)
                        .allowCredentials(true)
                        .maxAge(3600);
            }
        };
    }
}
