package com.example.company.core.common;

public final class ServiceUnavailableException extends ApiException {

    public ServiceUnavailableException(String message) {
        super(ErrorCode.SERVICE_UNAVAILABLE, 503, message);
    }

    public ServiceUnavailableException(String message, Throwable cause) {
        super(ErrorCode.SERVICE_UNAVAILABLE, 503, message);
        initCause(cause);
    }
}
