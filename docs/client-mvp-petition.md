# MVP

## 1 - TPV con posibilidad de mover mesas

Que debe tener el tpv básico:

### Módulos:

| Módulo                  | Funciones mínimas                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------ |
| 1. Catálogo             | Categorías, productos, precios, IVA, modificadores, disponibilidad y destino cocina/barra.                   |
| 2. Mesas y zonas        | Sala, terraza y barra; abrir, mover y unir mesas; número de comensales y estado de la mesa.                  |
| 3. Comandas             | Añadir productos, cantidades y notas; modificar pedidos; enviar a cocina; consultar la cuenta abierta.       |
| 4. Cocina y barra       | Recibir comandas por impresora o pantalla, separarlas por destino y marcarlas como preparadas.               |
| 5. Cobros y facturación | Efectivo, tarjeta y pago mixto; dividir cuenta; descuentos; tickets, facturas, devoluciones y reimpresiones. |
| 6. Caja                 | Apertura, movimientos de efectivo, arqueo, diferencias y cierre por método de pago.                          |
| 7. Usuarios y permisos  | Acceso mediante PIN, roles de camarero/encargado/administrador y registro de anulaciones o descuentos.       |
| 8. Informes             | Ventas diarias, impuestos, formas de pago, productos vendidos, ticket medio, descuentos y cierres de caja.   |

### Elementos transversales imprescindibles

Aunque no sean módulos visibles, el MVP también necesita:

- Funcionamiento temporal sin conexión.
- Prevención de cobros y comandas duplicadas.
- Copias de seguridad y recuperación de mesas abiertas.
- Integración con impresora, cajón y datáfono.
- Registro de acciones críticas.
- Facturación preparada para cumplir la normativa española y VERI*FACTU.

### Flujo principal:

abrir mesa → tomar comanda → enviar a cocina → añadir consumiciones → cobrar → emitir ticket → cerrar caja

## 2 - Reservas (trabajador o cliente final)

### Flujo

#### Flujo principal

1. Seleccionar fecha.
2. Indicar número de personas.
3. Ver horas disponibles y alternativas cercanas.
4. Elegir zona si procede: interior, terraza, barra…
5. Introducir nombre, teléfono y correo.
6. Añadir necesidades o comentarios.
7. Aceptar condiciones.
8. Confirmar la reserva o realizar un depósito.
9. Recibir confirmación y enlace para gestionarla.

### Funcionalidades importantes

- Disponibilidad real según mesas, aforo, turnos y duración estimada.
- Reserva sin necesidad de crear una cuenta.
- Sugerencias cuando no hay disponibilidad: otra hora, zona o día.
- Confirmación inmediata o modalidad “pendiente de aprobación”.
- Indicaciones sobre accesibilidad, tronas, mascotas o movilidad reducida.
- Campo para alergias y observaciones, aclarando que el restaurante debe confirmarlas.
- Política de cancelación visible antes de confirmar.
- Confirmación y recordatorios mediante correo, SMS o WhatsApp.
- Enlace para modificar o cancelar sin iniciar sesión.
- Varios idiomas.
- Protección contra reservas automatizadas y duplicadas.
- Consentimiento de privacidad y consentimiento comercial separados.

### Funcionalidades para el trabajador

#### Gestión diaria

- Vista de reservas por día, servicio y local.
- Modos lista, cronología y plano de sala.
- Crear una reserva telefónica en pocos segundos.
- Buscar por nombre, teléfono, localizador o comentario.
- Ver número de comensales confirmados por franja horaria.
- Editar fecha, hora, comensales, mesa y observaciones.
- Duplicar o trasladar reservas.
- Enviar manualmente una confirmación o recordatorio.

#### Estados operativos

Una reserva debería poder pasar por:

Pendiente → Confirmada → Ha llegado → Sentada → Finalizada

#### Gestión de mesas y sala

- Plano visual de mesas.
- Asignar y desasignar mesas.
- Mover una reserva de mesa.
- Juntar o separar mesas.
- Bloquear mesas temporalmente.
- Controlar la capacidad mínima y máxima de cada mesa.
- Evitar solapamientos y dobles reservas.
- Mostrar la próxima ocupación de cada mesa.
- Estimar cuándo quedará libre. (No urge para mvp)
- Sobrescribir una restricción con aviso y permiso especial.

#### Ficha del cliente

- Datos de contacto.
- Historial de reservas.
- Cancelaciones y no-shows.
- Preferencias declaradas.
- Alergias o necesidades importantes.
- Notas internas.
- Etiquetas como habitual, empresa o VIP.
- Consentimientos de comunicaciones.

#### Configuración para responsables

- Horarios y servicios: desayuno, comida, cena…
- Duración estimada según tamaño del grupo.
- Intervalos de reserva: cada 15, 30 o 60 minutos.
- Antelación mínima y máxima para reservar.
- Número máximo de reservas o comensales por franja.
- Capacidad por zonas.
- Tamaño máximo de grupo reservable por internet.
- Días cerrados, festivos y eventos especiales.
- Plantillas y horarios de notificaciones.
- Permisos por rol: sala, recepción, responsable y administración.

## 3 - Control horario integrado en el tpv

```text
Empleado → Pantalla de fichaje del TPV
                    ↓
         Servicio independiente de jornada
                    ↓
        Registro inmutable de eventos
                    ↓
   Portal empleado · Nóminas · Exportación Inspección
```

El fichaje aparecería antes de entrar en la operativa de ventas, con cuatro acciones muy claras:

- Entrar.
- Iniciar pausa.
- Terminar pausa.
- Salir.

La identificación sería mediante solamente PIN con controles contra intentos.

### Registro técnicamente defendible

Cada pulsación generaría un evento que no se puede borrar ni sobrescribir:

- trabajador
- empresa y centro
- entrada / pausa / regreso / salida
- fecha y hora del servidor
- zona horaria
- terminal de origen
- fecha de sincronización
- identificador único
- evento anterior y sello de integridad

### Particularidades de hostelería

El sistema debe contemplar expresamente:

- Jornadas partidas, registrando cada tramo.
- Turnos que comienzan un día y terminan después de medianoche.
- Pausas que cuentan o no como trabajo efectivo.
- Horas extraordinarias y, en contratos parciales, horas complementarias.
- Trabajo nocturno, festivos y descansos entre jornadas.
- Cambios de centro dentro de una misma empresa.
- Contratos temporales y empleados de refuerzo.
