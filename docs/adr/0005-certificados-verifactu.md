# ADR-0005 · Certificados VERI\*FACTU por tenant y reparto de responsabilidad

- Estado: aceptado (2026-09-08) para el diseño técnico; el reparto legal queda
  pendiente de validación por asesor fiscal antes de habilitar `prod`.
- Decide: cómo se autoconfigura la fiscalidad de cada restaurante.

## Contexto

Cada restaurante es un obligado tributario distinto, con su propio NIF, sus
series y su certificado. El requisito de producto es que lo configure él mismo
desde sus ajustes, sin intervención de Doscientos. Un certificado `.pfx` y su
contraseña son material criptográfico: filtrarlos permite firmar en nombre de un
tercero.

## Decisión técnica

1. **Nunca en cliente.** Ni el `.pfx`, ni su contraseña, ni la configuración SIF
   entran en el bundle del navegador ni en una variable `VITE_*`. Todo el código
   fiscal vive en `.server.ts`.
2. **Subida por endpoint servidor** con tamaño y tipo acotados. El servidor
   valida el certificado (se abre, no está caducado, el NIF del sujeto coincide
   con el NIF fiscal del tenant) **antes** de guardarlo.
3. **Cifrado en reposo** con Supabase Vault. La tabla `tenant_fiscal_settings`
   guarda una referencia al secreto, no el material. Solo el runtime Node lo
   descifra en el momento de emitir, en memoria, sin escribirlo a disco ni a log.
4. **Sin lectura de vuelta.** La UI muestra metadatos derivados (titular, NIF,
   fecha de caducidad, huella) y permite reemplazar o revocar. No existe endpoint
   de descarga del certificado. Escritura sí, lectura no.
5. **Modo por tenant.** `tenant_fiscal_settings.verifactu_env ∈ {mock,test,prod}`.
   El MVP arranca en `test`. Pasar a `prod` es un cambio de dato con requisitos
   verificados en servidor (certificado válido, NIF verificado por VNif, series
   configuradas, checklist superada), no un despliegue.
6. **Aviso de caducidad** y bloqueo de emisión con error público tipado cuando el
   certificado está caducado o ausente. No se intenta emitir «a ver si cuela».
7. **Auditoría** de alta, reemplazo, revocación y cambio de entorno en
   `fiscal_settings_audit`, append-only, sin material sensible.
8. Los logs registran identificador de operación. Nunca cuerpos privados,
   cookies, tokens, SOAP crudo ni fragmentos de certificado.

## Reparto de responsabilidad legal

No es asesoramiento legal. Es el reparto que asumimos y que debe confirmar un
asesor fiscal antes de habilitar `prod`.

| Parte       | Rol                                                  | Responsabilidad                                                                                                                                                                                                                 |
| ----------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Doscientos  | **Productor** del sistema informático de facturación | Que el software cumpla los requisitos reglamentarios y emitir la declaración responsable correspondiente; integridad, conservación, trazabilidad e inalterabilidad de los registros; que un tenant no pueda alterar los de otro |
| Restaurante | **Obligado tributario**                              | La veracidad y el contenido de sus facturas, sus datos fiscales, la custodia de su certificado y usar el sistema conforme a su obligación                                                                                       |

Consecuencias directas de ser productor de un sistema multiusuario en la nube:

- Separación estricta por obligado tributario: cadena de huellas, series y
  ledger **por NIF emisor**, jamás compartidos entre tenants.
- Los registros de facturación son append-only. No hay borrado ni edición, ni
  siquiera por un perfil global. La corrección es una subsanación o una
  rectificativa.
- Un operador de plataforma no puede emitir ni anular en nombre de un tenant.
- La declaración responsable se emite sobre una **versión concreta** del
  software: hay que versionar y registrar qué versión emitió cada registro.

## Puerta antes de `prod`

Se mantiene la checklist del paquete: suite en `mock` y AEAT `test` con
certificado de preproducción; alta, timeout/reintento, duplicado, rechazo y alta
por rechazo; anulación de la última alta aceptada; dos facturas intercaladas
comprobando la cadena global; cero secuencias duplicadas y cero enlaces de hash
rotos; cron autenticado con bloqueo por emisor y recuperación de locks caducados.
Ningún smoke test emite facturas reales.
