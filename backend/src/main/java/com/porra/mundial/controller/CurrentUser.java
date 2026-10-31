package com.porra.mundial.controller;

import java.security.Principal;

/** Acceso al usuario de la petición en los controladores. */
final class CurrentUser {

    private CurrentUser() {
    }

    /** Email del usuario autenticado, o null en peticiones anónimas a rutas públicas. */
    static String email(Principal principal) {
        return principal != null ? principal.getName() : null;
    }
}
