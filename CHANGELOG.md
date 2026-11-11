# Changelog

## [1.1.0] — 2026-11 · Incremento de Proyecto de Grado (UNAD, TRL5)

Incremento **aditivo**: ninguna funcionalidad existente se elimina ni cambia su forma de calificar.
La versión anterior queda congelada en la rama `release/v1-baseline`.

### Añadido
- **Pistas progresivas** (RF07): tres niveles estáticos por ejercicio ejecutable (concepto, construcciones, esqueleto enmascarado), con campo opcional `hints` para pistas de autor. Se suman a la Pista IA existente.
- **Diagnóstico del error** (RF08): clasificación determinista del fallo en SQL y Python, y solución de referencia tras aprobar o tras dos intentos fallidos.
- **Tiempo de ejecución** (RF14) del código del usuario en cada corrida.
- **Telemetría por intento** (RF15) en `stats.attempts`: se sincroniza con la fila de progreso, se fusiona entre dispositivos y se exporta a CSV desde *Stats*. Vista `v_attempts` y consultas de KPIs en `docs/ACCOUNTS.md`.
- **Inicio de sesión con Google** (RF01): OAuth 2.0 + PKCE sin SDK, detrás de la bandera `AUTH_GOOGLE`; el correo y contraseña se conservan como respaldo.
- **6 ejercicios de datos imperfectos** (RF13): 3 SQL y 3 Python sobre nulos frente a vacíos, normalización, montos en texto y perfil de calidad con pandas.
- Despliegue en **Cloudflare Pages** documentado; GitHub Pages se mantiene como respaldo.

### Cambiado
- La documentación refleja que el tutor IA usa **Gemini** a través del Worker.
- El modo examen sigue sin ayudas: no muestra pistas, diagnóstico ni solución.

## [1.0.0] — 2026-09-06
Versión base: 183 ejercicios (47 SQL y 50 Python ejecutables, 76 de opción múltiple y 10 abiertos), práctica, examen con reporte por categoría, guía, cuentas con aprobación y tutor IA opcional.
