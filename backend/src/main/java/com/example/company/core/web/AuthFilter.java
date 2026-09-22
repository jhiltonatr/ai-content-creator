package com.example.company.core.web;

import com.example.company.core.auth.AuthService;
import com.example.company.core.user.UserRecord;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.http.MediaType;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;
import tools.jackson.databind.json.JsonMapper;

import java.io.IOException;
import java.util.Map;

/**
 * Turns a {@code Authorization: Bearer <token>} header into the {@code X-User-Id} identity for
 * the request. Bearer tokens always win; the {@code X-User-Id} header is honored only while
 * {@code app.trust-x-user-id=true} (tests/demos). Anything else gets a 401 before reaching the
 * controllers — every {@code /api/**} endpoint except login is behind an authenticated user.
 */
@Component
public class AuthFilter extends OncePerRequestFilter {

    public static final String ATTR_USER_ID = "auth.userId";
    public static final String ATTR_TOKEN_HASH = "auth.tokenHash";
    private static final String BEARER_PREFIX = "Bearer ";

    private final AuthService auth;
    private final CoreProperties properties;
    private final JsonMapper mapper;

    public AuthFilter(AuthService auth, CoreProperties properties, JsonMapper mapper) {
        this.auth = auth;
        this.properties = properties;
        this.mapper = mapper;
    }

    @Override
    protected boolean shouldNotFilter(HttpServletRequest request) {
        String path = request.getRequestURI();
        return !path.startsWith("/api")
                || path.equals("/api/auth/login")
                || "OPTIONS".equals(request.getMethod());
    }

    @Override
    protected void doFilterInternal(HttpServletRequest request,
                                    HttpServletResponse response,
                                    FilterChain filterChain) throws ServletException, IOException {
        String rawToken = bearerToken(request);
        if (rawToken != null) {
            var user = auth.resolve(rawToken);
            if (user.isPresent()) {
                setUser(request, user.get(), rawToken);
                filterChain.doFilter(request, response);
                return;
            }
            unauthorized(response, "Invalid or expired token");
            return;
        }

        if (properties.trustXUserId()) {
            Long trustedId = trustedUserId(request);
            if (trustedId != null && auth.userExistsAndEnabled(trustedId)) {
                setUser(request, trustedId, null);
                filterChain.doFilter(request, response);
                return;
            }
        }
        unauthorized(response, "Authentication required");
    }

    private void setUser(HttpServletRequest request, UserRecord user, String rawToken) {
        request.setAttribute(ATTR_USER_ID, user.id());
        request.setAttribute(ATTR_TOKEN_HASH, rawToken);
    }

    private void setUser(HttpServletRequest request, long userId, String rawToken) {
        request.setAttribute(ATTR_USER_ID, userId);
        request.setAttribute(ATTR_TOKEN_HASH, rawToken);
    }

    private String bearerToken(HttpServletRequest request) {
        String header = request.getHeader("Authorization");
        if (header == null || !header.startsWith(BEARER_PREFIX)) {
            return null;
        }
        String token = header.substring(BEARER_PREFIX.length()).trim();
        return token.isEmpty() ? null : token;
    }

    private Long trustedUserId(HttpServletRequest request) {
        String header = request.getHeader("X-User-Id");
        if (header == null || header.isBlank()) {
            return null;
        }
        try {
            return Long.parseLong(header.trim());
        } catch (NumberFormatException e) {
            return null;
        }
    }

    private void unauthorized(HttpServletResponse response, String message) throws IOException {
        response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
        response.setContentType(MediaType.APPLICATION_JSON_VALUE);
        mapper.writeValue(response.getWriter(),
                Map.of("error", Map.of("code", "UNAUTHORIZED", "message", message)));
    }
}