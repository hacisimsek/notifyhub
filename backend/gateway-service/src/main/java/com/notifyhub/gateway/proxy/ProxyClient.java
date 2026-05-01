package com.notifyhub.gateway.proxy;

import org.springframework.http.ResponseEntity;

import java.net.URI;

public interface ProxyClient {

    ResponseEntity<byte[]> forward(URI targetUri, ProxyRequest request);
}
