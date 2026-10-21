# Cambio de hora del servicio 24–25/10/2026

Fuente: Complement del Quadre, «Operacions. Canvi d'hora Diumenge 25/10/2026», publicado el 21/10/2026. Texto aportado por el usuario; URL corporativa:
https://tmbbcn.sharepoint.com/sites/CQuadre/SitePages/20261021_Operacion_Canvi%20d'hora.aspx

Ámbito implementado: AAC de líneas convencionales, evento oficial `DISSABTE_CANVI_HORA` de octubre de 2026. La fuente oficial del calendario fija el día; no se calcula mediante «último sábado del mes». No se extrapola a otros años ni al cambio de primavera.

El reloj de servicio se mantiene sin atrasar hasta la salida, según la aclaración del usuario. Las dos referencias 02:40 no deben colapsarse en una resta simple ni generar una hora adicional automática para todos. Se conservan las horas publicadas y se almacenan las jornadas expresas separadamente:

| Perfil | Horario publicado | Jornada | Saldo específico |
| --- | --- | --- | --- |
| T1 | 04:30–13:20 | 8:50 | Mantiene cómputo general de completa pendiente |
| T2 | 12:50–21:40 | 8:50 | Mantiene cómputo general de completa pendiente |
| AT81 / T8.1 | 21:10–02:40 | 6:30 | 0, sin cómputo horario |
| AT82 / T8.2 | 23:30–05:00 | 6:30 | +1:00 |
| AT83 / T8.3 | 21:10–02:40 | 5:30 | 0, sin cómputo horario |
| T8 restante, AT86 y AT87 | 21:10–05:00 | 8:50 | Conserva base contractual y añade diferencia de jornada |
| T4 y T5 | Habitual | Habitual | Sin modificación |

Para los perfiles de 8:30 habituales, 8:50 son +20 minutos. Para los contratos cuya jornada habitual almacenada es distinta, la jornada publicada sigue siendo 8:50; se conserva su base de saldo contractual en lugar de forzar una base común.

La nocturnidad utiliza la duración confirmada sobre un intervalo continuo de reloj de servicio, aplicando la regla I-83 existente (>4 horas nocturnas, toda la jornada). No se añade otra hora por la repetición. El turno del domingo por la tarde ya sucede después del cambio y no queda pendiente por ese evento.

Se respetan descansos, ausencias RJ, modificaciones personales y asignaciones de verano incompletas. La app no modela la reducción individual de una jornada trabajada como tipo de contrato; los horarios personalizados permanecen explícitos y, si son ambiguos en la hora repetida, su nocturnidad queda pendiente. No se infiere que RJ (ausencia) sea una reducción de jornada. No se añaden perfiles TOLA.

Esta regla sustituye el horario LONG_SATURDAY genérico únicamente en el ámbito indicado. No modifica calendarios guardados, colores, reconocimiento de imágenes ni datos de sesión.
