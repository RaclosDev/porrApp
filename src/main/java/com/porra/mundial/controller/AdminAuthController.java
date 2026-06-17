package com.porra.mundial.controller;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/admin")
public class AdminAuthController {

    @Value("${admin.password}")
    private String adminPassword;

    // A simple in-memory token for the current session
    private static final String ADMIN_TOKEN = UUID.randomUUID().toString();

    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String password = payload.get("password");
        if (adminPassword.equals(password)) {
            return ResponseEntity.ok(Map.of("token", ADMIN_TOKEN));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Contraseña incorrecta"));
    }

    public static boolean isValidToken(String token) {
        return ADMIN_TOKEN.equals(token);
    }
}
