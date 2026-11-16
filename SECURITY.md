# Seguridad

## Versiones con soporte

Solo recibe correcciones la versión desplegada en [porrapp.app](https://porrapp.app), que corresponde a la rama `main`.

## Cómo avisar de una vulnerabilidad

No abras una issue pública. Usa el aviso privado de GitHub: pestaña **Security** del repositorio y **Report a vulnerability**.

Incluye, si puedes:

- Qué has encontrado y qué permite hacer.
- Los pasos para reproducirlo.
- La URL o el endpoint afectado.

Respondo en un plazo de 72 horas y te aviso cuando la corrección esté desplegada. No pruebes con cuentas ni datos de otras personas: una cuenta propia basta para demostrar el fallo.

## Qué queda fuera

- Ataques de denegación de servicio o pruebas de carga contra producción.
- Ingeniería social y acceso físico.
- Fallos de servicios de terceros (Google, Railway, proveedores de resultados deportivos).

Las medidas que ya aplica la aplicación están descritas en [docs/arquitectura.md](docs/arquitectura.md).
