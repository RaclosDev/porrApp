package com.porra.mundial.controller;

import com.porra.mundial.dto.LoginRequest;
import com.porra.mundial.dto.LoginResponse;
import com.porra.mundial.service.AuthService;
import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

/** Inicio de sesión con la credencial de Google Identity Services. */
@RestController
@RequestMapping("/api/auth/google")
@RequiredArgsConstructor
public class AuthGoogleController {

    private final AuthService authService;

    @PostMapping("/login")
    public LoginResponse loginWithGoogle(@Valid @RequestBody LoginRequest request) {
        return authService.loginWithGoogle(request.credential());
    }
}
