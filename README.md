# Aplicacion_Summer_Dent
Sistema para gestión de pacientes y administración del consultorio Summer Dent.

Este repositorio contiene el backend (API) y el frontend (app React + Vite) de la aplicación.

**Estructura principal**
- [Back_Summer_Dent](Back_Summer_Dent): servidor Node/Express que expone la API y se conecta a Supabase/Postgres.
- [Front_Summer_Dent](Front_Summer_Dent): cliente en React + Vite que consume la API.

**Requisitos previos**
- Node.js >= 18 y `npm` o `pnpm`.
- (Producción) Una base de datos PostgreSQL o una instancia Supabase.

## Configuración rápida

1) Clonar el repositorio (ya estás en la copia local en este equipo).

2) Backend — instalar dependencias y configurar variables de entorno

```bash
cd "Sistema SummerDent/Back_Summer_Dent"
npm install
```

Crear un archivo `.env` en la carpeta `Back_Summer_Dent` con las variables necesarias (ejemplo mínimo):

```
PORT=5000
# Conexión a Supabase/Postgres (opcionalmente usa SUPABASE_DB_URL)
SUPABASE_DB_URL=postgresql://usuario:pass@host:5432/dbname
# URL del frontend para CORS (opcional, separa por comas)
FRONTEND_URL=http://localhost:5173
# Supabase (si se utiliza)
SUPABASE_URL=https://tu-supabase.supabase.co
SUPABASE_ANON_KEY=pk.xxx
SUPABASE_SERVICE_ROLE_KEY=sk.xxx
```

Si prefieres configurar host/usuario/contraseña separados en lugar de `SUPABASE_DB_URL`, define `DB_HOST`, `DB_NAME`, `DB_USER`, `DB_PASS`, `DB_PORT`.

Comandos útiles para el backend:

```bash
# Modo desarrollo (con nodemon)
npm run dev
# Ejecutar en producción
npm start
```

3) Frontend — instalar dependencias y configurar URL del backend

```bash
cd "Sistema SummerDent/Front_Summer_Dent"
npm install
```

Crear un archivo `.env` en la carpeta `Front_Summer_Dent` con la URL del backend (opcional si usas el valor por defecto `http://localhost:5000`):

```
VITE_BACKEND_URL=http://localhost:5000
```

Comandos útiles para el frontend:

```bash
# Inicia Vite en modo desarrollo
npm run dev
# Generar build
npm run build
# Ver build localmente
npm run preview
```

## Uso
- Inicia primero el backend (`Back_Summer_Dent`).
- Luego inicia el frontend (`Front_Summer_Dent`) y abre `http://localhost:5173` en tu navegador.

## Variables y notas importantes
- El backend intenta usar `SUPABASE_DB_URL` (recomendado). Si no existe, construye la conexión con `DB_*` o `SUPABASE_DB_*` individuales.
- CORS: configura `FRONTEND_URL` en el backend para permitir peticiones desde dominios específicos.
- El frontend usa `VITE_BACKEND_URL` para apuntar a la API.

## Problemas comunes
- Error de conexión a la base de datos: verifica `SUPABASE_DB_URL` y que la base de datos acepte conexiones (SSL).
- 401 en peticiones API: revisa que las rutas protegidas requieran token y que el cliente lo esté enviando.
- CORS: añade la URL del frontend en `FRONTEND_URL` si el navegador bloquea solicitudes.

## Qué contiene este repositorio
- `Back_Summer_Dent`: API REST en Node/Express que gestiona productos, inventario, citas, pacientes, doctores, tratamientos y movimientos financieros. Se integra con Supabase/Postgres.
- `Front_Summer_Dent`: Cliente en React (Vite) con vistas para:
  - Autenticación (`/login`).
  - Dashboard: resumen del consultorio, accesos rápidos, `Citas de Hoy` y `Próximas Citas`.
  - Gestión de `Pacientes`, `Citas`, `Doctores`, `Inventario`, `Tratamientos` y `Finanzas`.
  - Componentes reutilizables: modales para crear/editar (`PacienteModal`, `CitaModal`, `InventarioModal`, etc.), tablas, y elementos UI.

## Cómo usar la aplicación cuando esté corriendo
1. Accede a la URL del frontend (por defecto `http://localhost:5173`).
2. Inicia sesión en la ruta de login si la aplicación lo requiere.
3. Navegación principal:
	- Usa el menú/side bar para moverte entre `Dashboard`, `Pacientes`, `Citas`, `Doctores`, `Inventario`, `Finanzas` y `Tratamientos`.
	- En el `Dashboard` encontrarás botones de acceso rápido: `Gestionar Pacientes`, `Ver Citas`, `Registrar Ingreso` y `Revisar Inventario`.
4. Citas:
	- `Citas de Hoy`: lista de las citas programadas para el día actual.
	- `Próximas Citas`: próximas citas programadas (muestra nombre de paciente, fecha, hora y estado).
	- Para crear o editar una cita, abre el modal correspondiente desde la vista `Citas` o desde botones rápidos.
5. Pacientes:
	- Añade, edita o busca pacientes desde la vista `Pacientes`.
	- Los modales permiten completar nombre, cédula, teléfono y observaciones.
6. Inventario y Productos:
	- Revisa stock, registra entradas/salidas y administra productos.
7. Finanzas:
	- Registra movimientos (ingresos/egresos) desde la vista `Finanzas` o el acceso rápido del `Dashboard`.


## Flujos importantes (ejemplos prácticos)

### 1) Marcar una cita como `Atendida`
- Endpoint: `PUT /api/citas/:id`
- Autenticación: requiere header `Authorization: Bearer <token>`.
- Payload mínimo para marcar como atendida:

```json
{
	"estado": "Atendida",
	"metodo_pago": "efectivo",           // opcional: "efectivo" | "transferencia" | "tarjeta"
	"detalle_pago": "Pago en caja"       // opcional
}
```

- Efectos:
	- El backend actualiza el estado de la cita.
	- Si la cita cambia a `Atendida`, el servidor intentará crear (o completar) un `movimiento_finanzas` de tipo `ingreso` con el monto de la cita (`precio`).
	- Si la base de datos tiene triggers que crean el movimiento, el controlador del backend asignará `id_perfil` y `metodo_pago` al movimiento si se envían.
	- Respuesta: JSON con `{ mensaje: 'Cita actualizada', cita: {...} }`.

### 2) Registrar una venta / salida de inventario (vender un producto)
- Endpoint: `POST /api/inventario/movimiento`
- Autenticación: requiere header `Authorization: Bearer <token>`.
- Payload ejemplo para una venta:

```json
{
	"id_producto": 123,
	"tipo_movimiento": "salida",
	"cantidad": 2,
	"metodo_pago": "tarjeta",       // opcional
	"detalle_pago": "Venta en mostrador"
}
```

- Efectos:
	- Se verifica stock suficiente; si no hay inventario, el endpoint falla con error.
	- Se resta la `cantidad` del inventario del producto.
	- Se crea un `movimiento_finanzas` de tipo `ingreso` por el total (precio_unitario * cantidad).
	- Respuesta: JSON con `{ mensaje: 'Salida registrada, stock actualizado y movimiento financiero creado', inventario: {...}, movimiento: {...} }`.

### 3) Registrar entradas de inventario
- Endpoint: `POST /api/inventario/aumentar` (o `POST /api/inventario/movimiento` con `tipo_movimiento: 'entrada'`).
- Payload ejemplo:

```json
{
	"id_producto": 123,
	"cantidad": 10
}
```

- Efectos: aumenta stock y retorna el inventario actualizado.

---
Notas:
- Todos los endpoints de modificación requieren autenticación (`Bearer token`).
- En caso de errores (stock insuficiente, IDs inválidos), el backend responde con código HTTP apropiado y un objeto `{ error: 'mensaje' }`.
- Revisa los controladores en `Back_Summer_Dent/src/controllers/` si necesitas adaptar o extender la lógica (por ejemplo, para cambiar la descripción del movimiento o aplicar descuentos automáticos).




