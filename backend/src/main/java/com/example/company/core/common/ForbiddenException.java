package com.example.company.core.common;

public final class ForbiddenException extends ApiException {

    public ForbiddenException(String message) {
        super(ErrorCode.FORBIDDEN, 403, message);
    }
}