# Tiendas-Rosmeri Gratis con Vercel + Supabase

## Que hace esta version

- Usa `Supabase` como base de datos gratis para `productos` y `ventas`.
- Usa `Vercel Functions` gratis para que el admin no exponga la clave en el navegador.
- Si la API todavia no esta configurada, el proyecto sigue funcionando en `modo local`.

## Paso 1: Crear Supabase gratis

1. Crea un proyecto gratis en Supabase.
2. Abre el `SQL Editor`.
3. Pega el contenido de [supabase/schema.sql](/C:/Users/leova/Desktop/roshop/supabase/schema.sql) y ejecútalo.
4. Copia estos valores del proyecto:
   - `Project URL`
   - `service_role key`

## Paso 2: Preparar la clave admin

Usa la clave que quieras en Vercel. Si queres mantener la actual, su hash SHA-256 es:

```text
f9135e272b0cdc382b63971604bfec43f609a8fcc4165196ce23b136e34cb2ba
```

Tambien vas a necesitar un secreto cualquiera para firmar la sesion admin. Ejemplo:

```text
ROSMERI-SESSION-2026-CAMBIA-ESTO
```

## Paso 3: Crear Vercel gratis

1. Sube esta carpeta a GitHub.
2. Importa el repo en Vercel.
3. En `Environment Variables` agrega:
   - `SUPABASE_PROJECT_URL`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `ROSMERI_ADMIN_CODE_SHA256`
   - `ROSMERI_SESSION_SECRET`
4. Publica el proyecto.

## Paso 4: Resultado

- La tienda publica lee productos desde `/api/products`.
- El admin entra con login por `/api/admin-login`.
- Altas, cambios, ocultar producto y ventas pasan por `Vercel Functions`.
- Otras computadoras van a ver los mismos productos y ventas porque ya no depende de `localStorage`.

## Archivos importantes

- Frontend tienda: [index.html](/C:/Users/leova/Desktop/roshop/index.html)
- Frontend admin: [admin.html](/C:/Users/leova/Desktop/roshop/admin.html)
- Capa de datos: [data.js](/C:/Users/leova/Desktop/roshop/data.js)
- APIs Vercel: [api](/C:/Users/leova/Desktop/roshop/api)
- Esquema SQL: [supabase/schema.sql](/C:/Users/leova/Desktop/roshop/supabase/schema.sql)
