# Pruebas de Redsys

El entorno de Preview debe usar `REDSYS_ENVIRONMENT=test`. En ese caso la
aplicación envía el formulario a `https://sis-t.redsys.es:25443/` y las
operaciones no tienen validez contable.

## Tarjetas sandbox

En la pantalla de Redsys **Pagar con Tarjeta** se pueden usar estas tarjetas
oficiales de prueba:

| Marca y flujo                 | Número                | Caducidad | CVV   |
| ----------------------------- | --------------------- | --------- | ----- |
| VISA EMV 3-D Secure 2.2       | `4548 8100 0000 0003` | `12/49`   | `123` |
| Mastercard EMV 3-D Secure 2.1 | `5576 4415 6304 5037` | `12/49`   | `123` |

No se debe introducir una tarjeta real. Estas tarjetas sólo funcionan en el
entorno sandbox de Redsys. La documentación oficial y el listado actualizado
están en [Tarjetas y entornos de prueba de Redsys][redsys-test-cards].

## Confirmación del pago

El retorno del navegador a `successUrl` no confirma por sí solo el pago. La
confirmación que cambia la suscripción llega mediante un `POST` de Redsys a:

`/api/webhooks/redsys`

El dominio usado por `APP_URL` debe ser accesible públicamente para Redsys. No
se puede usar un Preview protegido por Vercel Authentication como endpoint de
webhook, porque Redsys no puede completar ese login. Para probar Preview hay
que desactivar la protección de despliegue para ese entorno o publicar el
webhook en un dominio público separado y configurar allí `APP_URL`.

[redsys-test-cards]: https://pagosonline.redsys.es/desarrolladores-inicio/integrate-con-nosotros/tarjetas-y-entornos-de-prueba/
