package com.notifyhub.gateway.proxy;

import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpMethod;

public record ProxyRequest(
        HttpMethod method,
        String path,
        String query,
        HttpHeaders headers,
        byte[] body
) {
}
