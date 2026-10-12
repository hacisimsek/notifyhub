package com.notifyhub.common.web;

import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockFilterChain;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.mock.web.MockHttpServletResponse;

import static org.assertj.core.api.Assertions.assertThat;

class InternalServiceTokenFilterTests {

    @Test
    void rejectsApiCallWithoutToken() throws Exception {
        MockHttpServletResponse response = run(new InternalServiceTokenFilter("secret-token"), "/api/reminders", null);

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void rejectsInternalCallWithWrongToken() throws Exception {
        MockHttpServletResponse response = run(new InternalServiceTokenFilter("secret-token"), "/internal/notifications", "guess");

        assertThat(response.getStatus()).isEqualTo(401);
    }

    @Test
    void allowsCallWithMatchingToken() throws Exception {
        MockHttpServletResponse response = run(new InternalServiceTokenFilter("secret-token"), "/api/reminders", "secret-token");

        assertThat(response.getStatus()).isEqualTo(200);
    }

    @Test
    void leavesHealthAndInfoEndpointsOpen() throws Exception {
        InternalServiceTokenFilter filter = new InternalServiceTokenFilter("secret-token");

        assertThat(run(filter, "/actuator/health", null).getStatus()).isEqualTo(200);
        assertThat(run(filter, "/internal/info", null).getStatus()).isEqualTo(200);
    }

    @Test
    void isDisabledWhenNoTokenIsConfigured() throws Exception {
        MockHttpServletResponse response = run(new InternalServiceTokenFilter(""), "/api/reminders", null);

        assertThat(response.getStatus()).isEqualTo(200);
    }

    private MockHttpServletResponse run(InternalServiceTokenFilter filter, String path, String token) throws Exception {
        MockHttpServletRequest request = new MockHttpServletRequest("GET", path);
        if (token != null) {
            request.addHeader(InternalServiceTokenFilter.HEADER, token);
        }
        MockHttpServletResponse response = new MockHttpServletResponse();
        filter.doFilter(request, response, new MockFilterChain());
        return response;
    }
}
