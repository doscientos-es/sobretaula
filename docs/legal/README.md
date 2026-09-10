# Paquete legal de SobreTaula

Las versiones publicadas se sirven desde estas rutas:

- `/legal/privacidad`: tratamiento de datos de usuarios de SobreTaula.
- `/legal/cookies`: almacenamiento técnico y futuras cookies opcionales.
- `/legal/condiciones-saas`: condiciones B2B de la suscripción.
- `/reservar/:slug/privacidad` y `/reservar/:slug/condiciones`: información de
  cada restaurante para personas que reservan.

## Requisito de publicación

Antes de activar producción hay que configurar la identidad fiscal de
SobreTaula en Administración y `LEGAL_CONTACT_EMAIL` en el entorno. Cada alta
de restaurante ya exige razón social, NIF, dirección y correo de facturación;
la aplicación muestra esos datos únicamente en sus páginas legales públicas
del flujo de reserva. Si falta alguno, la página advierte que no se debe
publicar ni contratar.

## Revisión humana obligatoria

Estos textos son una base operativa y no sustituyen la revisión de un abogado
ni de un asesor fiscal. Antes de activar una política de depósito hay que
completar en el flujo, antes del pago, el importe total, impuestos, fecha
límite de cancelación, criterio de cargo/no-show y proceso de devolución. El
encargo de tratamiento RGPD con cada restaurante se firma fuera del producto y
debe listar subencargados, transferencias internacionales, medidas de
seguridad, asistencia en derechos e incidentes y devolución/supresión de datos.
