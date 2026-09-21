package com.example.company.core.common;

public final class ConflictException extends ApiException {

    private transient Object current;

    public ConflictException(String message) {
        super(ErrorCode.CONFLICT, 409, message);
    }

    public ConflictException(String message, Object current) {
        super(ErrorCode.CONFLICT, 409, message);
        this.current = current;
    }

    public Object current() {
        return current;
    }
}