package com.porra.mundial.controller;

import com.porra.mundial.config.JwtUtil;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.Map;

/**
 * Controlador REST encargado de la autenticación de los administradores.
 * Permite a los superusuarios obtener un token JWT administrativo válido
 * al proporcionar la contraseña correcta.
 */
@lombok.extern.slf4j.Slf4j
@RestController
@RequestMapping("/api/admin")
@RequiredArgsConstructor
public class AdminAuthController {

    private final JwtUtil jwtUtil;

    // Contraseña definida en variables de entorno (ADMIN_PASSWORD). Si no está seteada, el login queda inhabilitado.
    @Value("${admin.password:}")
    private String adminPassword;

    /**
     * Endpoint para iniciar sesión como administrador.
     * 
     * @param payload Mapa JSON que contiene el campo "password" enviado por el frontend.
     * @return ResponseEntity con el token JWT si la contraseña es correcta, o un 401 Unauthorized si es incorrecta.
     */
    @PostMapping("/login")
    public ResponseEntity<?> login(@RequestBody Map<String, String> payload) {
        String password = payload != null ? payload.get("password") : null;
        if (adminPassword == null || adminPassword.isBlank()) {
            log.error("ADMIN_PASSWORD no está configurada en las variables de entorno.");
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE)
                    .body(Map.of("error", "El acceso administrativo no está configurado en el servidor"));
        }
        if (password != null && adminPassword.equals(password)) {
            String token = jwtUtil.generateToken("admin");
            return ResponseEntity.ok(Map.of("token", token));
        }
        return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(Map.of("error", "Contraseña incorrecta"));
    }
}
