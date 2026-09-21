package com.example.company.core.common;

public final class BadRequestException extends ApiException {

    public BadRequestException(String message) {
        super(ErrorCode.BAD_REQUEST, 400, message);
    }
}