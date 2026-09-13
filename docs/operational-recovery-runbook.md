# SobreTaula · Runbook operativo de recuperación

Este procedimiento está pensado para un entorno de pruebas o para un local
autorizado. Nunca se restauran datos directamente sobre producción sin una
ventana aprobada, copia verificable y responsable identificado.

## 1. Clasificar el incidente

1. **Sin conexión en una tablet:** mantener el banner de estado visible,
   continuar solo con operaciones que la cola marque como compatibles y no
   repetir una acción que figure como `pending`.
2. **Operación pendiente:** abrir la cola offline, comprobar la clave de
   operación y reintentar una sola vez cuando vuelva la conexión. Si aparece
   conflicto, conservar el registro local y escalarlo; no sobrescribir el
   estado remoto manualmente.
3. **Cuenta o mesa en estado inesperado:** detener nuevas mutaciones sobre esa
   mesa, capturar tenant, local, mesa, cuenta y hora, y revisar la auditoría.
4. **Cobro dudoso:** no volver a cobrar. Buscar la operación por su clave
   idempotente y verificar el pago y el saldo antes de actuar.
5. **Fallo fiscal:** conservar la factura pendiente y el código accionable;
   corregir certificado o datos y reintentar desde el flujo autorizado. No
   marcar manualmente como enviada una factura sin respuesta verificable.

## 2. Recuperar una sesión de trabajo

- Confirmar que el usuario sigue autenticado y que el local activo es el
  correcto.
- Recargar la ruta del local y comprobar que el banner indica sincronización.
- Revisar primero las operaciones pendientes y resolver conflictos antes de
  abrir nuevas comandas.
- Comparar mesas abiertas, cuentas y reservas con el último handover.
- Registrar en auditoría el incidente, la decisión y el responsable.

## 3. Backup y restore de Supabase

El backup y el restore los ejecuta únicamente el responsable del proyecto
Supabase mediante sus controles aprobados. El equipo de SobreTaula no guarda
credenciales ni ejecuta comandos destructivos desde la aplicación.

Antes de restaurar:

- identificar proyecto, entorno y punto temporal;
- confirmar que la copia es legible y que incluye datos y esquema necesarios;
- detener jobs/mutaciones del entorno afectado;
- crear una copia de seguridad del estado actual;
- documentar aprobador, motivo y ventana de mantenimiento.

Después de restaurar, ejecutar en un entorno aislado:

1. login de un usuario de propietario, encargado y camarero;
2. lectura y escritura dentro del tenant y local permitidos;
3. denegación de lectura cruzada entre tenants y locales;
4. reserva, sesión de servicio, comanda, cuenta, pago idempotente y cierre de
   caja con claves de prueba;
5. comprobación de auditoría, exportaciones y colas offline;
6. verificación de que ningún dato de fixture o prueba ha llegado a
   producción.

El restore no se considera validado hasta conservar los identificadores de la
ejecución, resultados y responsable. La migración remota y esta prueba siguen
siendo un gate externo mientras no exista un proyecto autorizado conectado.

## 4. Evidencia mínima de cada incidente

Registrar fecha y zona horaria, entorno, tenant/local, usuario y rol, operación
idempotente, pantalla, mensaje visible, estado anterior y posterior, pasos de
recuperación, resultado y enlace o identificador de auditoría. No incluir
contraseñas, PIN, certificados, tokens ni datos completos de tarjetas.

## 5. Criterio de salida

El responsable del turno confirma que las mesas, cuentas, cobros, caja,
fichajes y reservas coinciden con el estado auditado. Si no puede confirmarlo,
se mantiene el incidente abierto y se escala; no se oculta el error ni se
declara el servicio recuperado.
