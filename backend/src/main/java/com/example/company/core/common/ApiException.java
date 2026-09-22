package com.example.company.core.common;

public class ApiException extends RuntimeException {

    private final ErrorCode code;
    private final int status;

    public ApiException(ErrorCode code, int status, String message) {
        super(message);
        this.code = code;
        this.status = status;
    }

    public ErrorCode code() {
        return code;
    }

    public int status() {
        return status;
    }

    public enum ErrorCode {
        BAD_REQUEST,
        UNAUTHORIZED,
        FORBIDDEN,
        NOT_FOUND,
        CONFLICT,
        SERVICE_UNAVAILABLE
    }
}