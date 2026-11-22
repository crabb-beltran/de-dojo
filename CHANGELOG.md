# Changelog

## [1.1.1] — 2026-11-22 · Validación TRL5
### Corregido
- El registro envía `redirect_to`, de modo que el correo de confirmación regresa a la misma URL y edición (antes llevaba a un 404).
### Seguridad
- Se revoca `EXECUTE` a `public`, `anon` y `authenticated` sobre `handle_new_user()` y `rls_auto_enable()` (hallazgo del asesor de Supabase).
- Vista `v_attempts` con `security_invoker` para el análisis de telemetría.
### Documentación
- `docs/VALIDATION.md`: protocolo, formulario SUS e indicadores. Resultados: 8 usuarios externos, SUS medio 94,1, 91 % de fallos de código diagnosticados, 98,7 % de corridas con retroalimentación < 2 s.
- `docs/ARCHITECTURE.md`: interacción de componentes internos, secuencias de Práctica y Examen, pipeline de telemetría y ediciones (12 diagramas Mermaid); cifras del banco actualizadas (189 ejercicios, 103 ejecutables).

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
- Despliegue en **GitHub Pages** (producción) con **Cloudflare Pages** documentado como alternativa.
- **Edición académica** (`?edition=academic` o rama `proyecto-grado`): muestra solo el alcance del proyecto de grado y oculta el tutor IA, el cobro y las preguntas abiertas calificadas por IA. No borra código; `full` sigue siendo la edición por defecto.

### Cambiado
- La documentación refleja que el tutor IA usa **Gemini** a través del Worker.
- El modo examen sigue sin ayudas: no muestra pistas, diagnóstico ni solución.

## [1.0.0] — 2026-09-06
Versión base: 183 ejercicios (47 SQL y 50 Python ejecutables, 76 de opción múltiple y 10 abiertos), práctica, examen con reporte por categoría, guía, cuentas con aprobación y tutor IA opcional.
