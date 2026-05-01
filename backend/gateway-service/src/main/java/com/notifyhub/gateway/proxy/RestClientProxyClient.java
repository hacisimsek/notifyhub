package com.notifyhub.gateway.proxy;

import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;
import org.springframework.web.client.RestClient;
import org.springframework.web.client.RestClientResponseException;

import java.net.URI;
import java.util.Locale;

@Component
class RestClientProxyClient implements ProxyClient {

    private final RestClient restClient;

    RestClientProxyClient(RestClient restClient) {
        this.restClient = restClient;
    }

    @Override
    public ResponseEntity<byte[]> forward(URI targetUri, ProxyRequest request) {
        try {
            RestClient.RequestBodySpec spec = restClient
                    .method(request.method())
                    .uri(targetUri)
                    .headers(headers -> headers.addAll(request.headers()));

            ResponseEntity<byte[]> response = request.body() == null || request.body().length == 0
                    ? spec.retrieve().toEntity(byte[].class)
                    : spec.body(request.body()).retrieve().toEntity(byte[].class);

            return ResponseEntity
                    .status(response.getStatusCode())
                    .headers(filterResponseHeaders(response.getHeaders()))
                    .body(response.getBody());
        } catch (RestClientResponseException ex) {
            return ResponseEntity
                    .status(ex.getStatusCode())
                    .headers(filterResponseHeaders(ex.getResponseHeaders()))
                    .body(ex.getResponseBodyAsByteArray());
        }
    }

    private HttpHeaders filterResponseHeaders(HttpHeaders source) {
        HttpHeaders headers = new HttpHeaders();
        if (source == null) {
            return headers;
        }

        source.forEach((name, values) -> {
            String normalized = name.toLowerCase(Locale.ROOT);
            if (!normalized.equals("transfer-encoding") && !normalized.equals("connection")) {
                headers.addAll(name, values);
            }
        });
        return headers;
    }
}
