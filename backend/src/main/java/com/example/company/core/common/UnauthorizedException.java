package com.example.company.core.common;

public final class UnauthorizedException extends ApiException {

    public UnauthorizedException(String message) {
        super(ErrorCode.UNAUTHORIZED, 401, message);
    }
}