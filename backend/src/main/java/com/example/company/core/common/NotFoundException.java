package com.example.company.core.common;

public final class NotFoundException extends ApiException {

    public NotFoundException(String message) {
        super(ErrorCode.NOT_FOUND, 404, message);
    }
}