package com.porra.mundial.controller;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.porra.mundial.config.JwtUtil;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.mockito.Mockito;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.test.web.servlet.MockMvc;

import java.util.Map;

import static org.mockito.ArgumentMatchers.eq;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

@WebMvcTest(AdminAuthController.class)
@AutoConfigureMockMvc(addFilters = false)
class AdminAuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @Autowired
    private ObjectMapper objectMapper;

    @Autowired
    private AdminAuthController adminAuthController;

    @MockBean
    private JwtUtil jwtUtil;

    @Test
    @DisplayName("Login correcto devuelve 200 y token JWT")
    void loginWithCorrectPasswordReturnsToken() throws Exception {
        ReflectionTestUtils.setField(adminAuthController, "adminPassword", "secret123");
        Mockito.when(jwtUtil.generateToken("admin")).thenReturn("mocked.jwt.token");

        mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", "secret123"))))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.token").value("mocked.jwt.token"));
    }

    @Test
    @DisplayName("Login con contraseña incorrecta devuelve 401 Unauthorized")
    void loginWithWrongPasswordReturnsUnauthorized() throws Exception {
        ReflectionTestUtils.setField(adminAuthController, "adminPassword", "secret123");

        mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", "wrongpassword"))))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.error").value("Contraseña incorrecta"));
    }

    @Test
    @DisplayName("Si ADMIN_PASSWORD no está configurada devuelve 503 Service Unavailable")
    void loginWhenPasswordNotConfiguredReturnsServiceUnavailable() throws Exception {
        ReflectionTestUtils.setField(adminAuthController, "adminPassword", "");

        mockMvc.perform(post("/api/admin/login")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content(objectMapper.writeValueAsString(Map.of("password", "any"))))
                .andExpect(status().isServiceUnavailable())
                .andExpect(jsonPath("$.error").value("El acceso administrativo no está configurado en el servidor"));
    }
}
