package com.example.company.core.web;

import com.example.company.core.common.ApiException;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.http.converter.HttpMessageNotReadableException;
import org.springframework.validation.FieldError;
import org.springframework.web.bind.MethodArgumentNotValidException;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.servlet.resource.NoResourceFoundException;

import java.util.LinkedHashMap;
import java.util.Map;

@RestControllerAdvice
public class ApiExceptionHandler {

    private static final Logger log = LoggerFactory.getLogger(ApiExceptionHandler.class);

    @ExceptionHandler(ApiException.class)
    public ResponseEntity<Map<String, Object>> handleApi(ApiException ex) {
        logDebug(ex);
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", ex.code());
        error.put("message", ex.getMessage());
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", error);
        if (ex instanceof com.example.company.core.common.ConflictException conflict
                && conflict.current() != null) {
            body.put("current", conflict.current());
        }
        return ResponseEntity.status(ex.status()).body(body);
    }

    @ExceptionHandler(MethodArgumentNotValidException.class)
    public ResponseEntity<Map<String, Object>> handleValidation(MethodArgumentNotValidException ex) {
        var messages = ex.getBindingResult().getFieldErrors().stream()
                .map(FieldError::getDefaultMessage)
                .toList();
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", ApiException.ErrorCode.BAD_REQUEST);
        error.put("message", "Validation failed: " + String.join("; ", messages));
        return ResponseEntity.badRequest().body(Map.of("error", error));
    }

    @ExceptionHandler(HttpMessageNotReadableException.class)
    public ResponseEntity<Map<String, Object>> handleUnreadable(HttpMessageNotReadableException ex) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", ApiException.ErrorCode.BAD_REQUEST);
        error.put("message", "Malformed request body");
        return ResponseEntity.badRequest().body(Map.of("error", error));
    }

    @ExceptionHandler(NoResourceFoundException.class)
    public ResponseEntity<Map<String, Object>> handleNoResource(NoResourceFoundException ex) {
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", ApiException.ErrorCode.NOT_FOUND);
        error.put("message", "Not found");
        return ResponseEntity.status(HttpStatus.NOT_FOUND).body(Map.of("error", error));
    }

    @ExceptionHandler(Exception.class)
    public ResponseEntity<Map<String, Object>> handleOther(Exception ex) {
        log.error("Unhandled exception", ex);
        Map<String, Object> error = new LinkedHashMap<>();
        error.put("code", ApiException.ErrorCode.BAD_REQUEST);
        error.put("message", "Internal error");
        return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(Map.of("error", error));
    }

    private void logDebug(ApiException ex) {
        if (ex.status() >= 500) {
            log.error("Api error", ex);
        } else {
            log.debug("Api error {}: {}", ex.code(), ex.getMessage());
        }
    }
}