# ADR-0003 · Resolución de tenant por ruta, con subdominio preparado

- Estado: aceptado (2026-09-08).
- Decide: cómo se identifica el restaurante activo en cada petición.

## Contexto

El diseño de producto contempla `restaurante.sobretaula.com`, pero el dominio
todavía no existe. Bloquear el desarrollo hasta tenerlo no aporta nada, y
construir sobre subdominios sin poder probarlos produce código no verificado.

## Decisión

El MVP resuelve el tenant por **segmento de ruta**: `/t/:tenantSlug/...`.

Toda la lógica de resolución vive en un único módulo,
`src/shared/lib/tenant/resolve-tenant-slug.ts`, con una firma que acepta la
petición completa. Añadir subdominios será implementar la rama que lee el
encabezado `Host` dentro de esa función y una redirección de compatibilidad,
sin tocar rutas, features ni políticas.

Reglas:

1. El slug es un **selector de UI**, nunca prueba de pertenencia. Cada server
   function resuelve `tenant_id` desde el slug y comprueba `memberships` antes
   de ejecutar el caso de uso.
2. El slug se valida con un esquema estricto (minúsculas, dígitos y guiones,
   longitud acotada) y una lista de slugs reservados (`admin`, `api`, `www`,
   `app`, `soporte`, `status`).
3. `tenants.slug` es único e inmutable en la práctica: cambiarlo exige una
   redirección persistida en `tenant_slug_history`, no un `UPDATE` a secas.
4. El slug forma parte de las query keys de Query. Al cambiar de tenant se
   cancelan lecturas en vuelo y se retira la caché privada anterior, para que
   una respuesta tardía no repueble datos de otro restaurante.
5. Las respuestas privadas se sirven con `Cache-Control: no-store`, incluido el
   HTML y las respuestas que renuevan cookies.

Las rutas de plataforma (`/admin/...`) y las públicas (`/login`, futura web de
reservas) quedan fuera del prefijo `/t/` y con su propia autorización.

## Consecuencias

- No se necesita wildcard DNS ni certificados comodín en el MVP: menos coste y
  menos dependencias de hosting.
- Hay que evitar en todo el código la tentación de leer el slug desde
  `window.location`: se obtiene siempre de los params tipados del Router en
  cliente y de la petición en servidor.
- Al migrar a subdominios habrá que revisar cookies (dominio padre, `SameSite`)
  y aislamiento de sesión entre subdominios. Se documentará en un ADR nuevo, no
  ampliando este.
