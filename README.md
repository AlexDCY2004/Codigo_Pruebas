# 🦷 SummerDent — Sistema de Gestión para Clínica Dental

Sistema web completo para la gestión de una clínica dental. Permite administrar pacientes, doctores, citas, tratamientos, inventario de productos y movimientos financieros (ingresos/egresos).

---

## 📋 Tabla de contenidos

- [Tecnologías utilizadas](#-tecnologías-utilizadas)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Requisitos previos](#-requisitos-previos)
- [Instalación y configuración](#-instalación-y-configuración)
  - [1. Clonar el repositorio](#1-clonar-el-repositorio)
  - [2. Configurar el Backend](#2-configurar-el-backend)
  - [3. Configurar el Frontend](#3-configurar-el-frontend)
- [Ejecución del proyecto](#-ejecución-del-proyecto)
- [Variables de entorno](#-variables-de-entorno)
- [Endpoints de la API](#-endpoints-de-la-api)
- [Scripts disponibles](#-scripts-disponibles)

---

## 🛠 Tecnologías utilizadas

### Backend
| Tecnología | Descripción |
|---|---|
| **Node.js** | Entorno de ejecución de JavaScript |
| **Express 5** | Framework web para la API REST |
| **Supabase** | Base de datos PostgreSQL en la nube (autenticación y almacenamiento) |
| **Sequelize** | ORM para PostgreSQL (opcional) |
| **dotenv** | Manejo de variables de entorno |
| **cors** | Manejo de políticas CORS |
| **nodemon** | Reinicio automático del servidor en desarrollo |

### Frontend
| Tecnología | Descripción |
|---|---|
| **React 19** | Biblioteca para la interfaz de usuario |
| **Vite 8** | Bundler y servidor de desarrollo |
| **React Router DOM 7** | Enrutamiento del lado del cliente |
| **Axios** | Cliente HTTP para consumo de la API |
| **Zustand** | Manejo de estado global (autenticación) |
| **TanStack React Query** | Manejo de estado del servidor y caché |
| **Lucide React** | Iconos SVG |

---

## 📁 Estructura del proyecto

```
Codigo_Pruebas/
├── README.md
└── Sistema SummerDent/
    ├── .gitignore
    ├── Back_Summer_Dent/          # API REST (Backend)
    │   ├── app.js                 # Punto de entrada del servidor
    │   ├── package.json
    │   └── src/
    │       ├── configuracionesDB/ # Conexión a Supabase y Sequelize
    │       ├── controllers/       # Lógica de negocio
    │       ├── middleware/        # Middleware de autenticación
    │       ├── models/            # Modelos de datos
    │       └── routes/            # Definición de rutas
    └── Front_Summer_Dent/         # Interfaz de usuario (Frontend)
        ├── index.html
        ├── vite.config.js
        ├── package.json
        └── src/
            ├── app/               # Providers y router
            ├── components/        # Componentes reutilizables
            ├── pages/             # Páginas de la aplicación
            ├── services/api/      # Clientes HTTP (Axios)
            ├── store/             # Estado global (Zustand)
            ├── styles/            # Archivos CSS
            └── lib/               # Utilidades
```

---

## ✅ Requisitos previos

Antes de comenzar, asegúrate de tener instalado:

- **Node.js** (versión 18 o superior) — [Descargar aquí](https://nodejs.org/)
- **npm** (incluido con Node.js)
- **Git** — [Descargar aquí](https://git-scm.com/)
- Una cuenta en **Supabase** con un proyecto creado — [supabase.com](https://supabase.com/)

Para verificar que tienes Node.js y npm instalados, ejecuta en tu terminal:

```bash
node -v
npm -v
```

---

## 🚀 Instalación y configuración

### 1. Clonar el repositorio

```bash
git clone https://github.com/AlexDCY2004/Codigo_Pruebas.git
cd Codigo_Pruebas
```

---

### 2. Configurar el Backend

#### 2.1 Instalar dependencias

```bash
cd "Sistema SummerDent/Back_Summer_Dent"
npm install
```

#### 2.2 Crear archivo de variables de entorno

Crea un archivo `.env` en la carpeta `Back_Summer_Dent/` con el siguiente contenido:

```env
# Puerto del servidor (por defecto: 5000)
PORT=5000

# URL del proyecto en Supabase
SUPABASE_URL=https://tu-proyecto.supabase.co

# Clave pública (anon key) de Supabase
SUPABASE_ANON_KEY=tu_anon_key_aqui

# Clave de servicio (service role key) de Supabase
SUPABASE_SERVICE_ROLE_KEY=tu_service_role_key_aqui

# (Opcional) URL de conexión directa a la base de datos PostgreSQL de Supabase
# Si la defines, Sequelize la usará en lugar de los parámetros individuales
# SUPABASE_DB_URL=postgresql://postgres:password@host:5432/postgres

# (Opcional) Parámetros individuales de conexión a la BD (si no usas SUPABASE_DB_URL)
# DB_HOST=tu_host
# DB_PORT=5432
# DB_NAME=postgres
# DB_USER=postgres
# DB_PASS=tu_password

# (Opcional) Habilitar Sequelize (por defecto usa solo Supabase Client)
# USE_SEQUELIZE=true

# (Opcional) URLs del frontend permitidas por CORS (separadas por coma)
# FRONTEND_URL=http://localhost:5173
```

> **📌 ¿Dónde obtener las claves de Supabase?**
> 1. Ve a tu [dashboard de Supabase](https://app.supabase.com/).
> 2. Selecciona tu proyecto.
> 3. Ve a **Settings → API**.
> 4. Copia la **URL**, la **anon key** y la **service role key**.

---

### 3. Configurar el Frontend

#### 3.1 Instalar dependencias

Abre **otra terminal** y ejecuta:

```bash
cd "Sistema SummerDent/Front_Summer_Dent"
npm install
```

#### 3.2 Crear archivo de variables de entorno (opcional)

Si el backend corre en el puerto por defecto (`5000`), **no necesitas crear este archivo**. El frontend se conectará automáticamente a `http://localhost:5000`.

Si necesitas cambiar la URL del backend, crea un archivo `.env` en la carpeta `Front_Summer_Dent/`:

```env
# URL del backend (por defecto: http://localhost:5000)
VITE_BACKEND_URL=http://localhost:5000
```

---

## ▶ Ejecución del proyecto

Necesitas **dos terminales** abiertas simultáneamente, una para el backend y otra para el frontend.

### Terminal 1 — Iniciar el Backend

```bash
cd "Sistema SummerDent/Back_Summer_Dent"
npm run dev
```

Deberías ver un mensaje como:
```
Iniciando sin Sequelize (usando Supabase).
Servidor corriendo en el puerto 5000
```

### Terminal 2 — Iniciar el Frontend

```bash
cd "Sistema SummerDent/Front_Summer_Dent"
npm run dev
```

Deberías ver un mensaje como:
```
  VITE v8.x.x  ready in XXX ms

  ➜  Local:   http://localhost:5173/
```

### 🌐 Acceder a la aplicación

Abre tu navegador y ve a: **http://localhost:5173**

Serás redirigido a la página de inicio de sesión (`/login`).

---

## 🔐 Variables de entorno

### Backend (`Back_Summer_Dent/.env`)

| Variable | Requerida | Descripción |
|---|---|---|
| `PORT` | No | Puerto del servidor (default: `5000`) |
| `SUPABASE_URL` | **Sí** | URL de tu proyecto en Supabase |
| `SUPABASE_ANON_KEY` | **Sí** | Clave pública (anon) de Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | **Sí** | Clave de servicio de Supabase |
| `SUPABASE_DB_URL` | No | URL de conexión directa a PostgreSQL |
| `USE_SEQUELIZE` | No | Habilitar Sequelize ORM (`true`/`false`) |
| `FRONTEND_URL` | No | URLs del frontend para CORS (separadas por coma) |

### Frontend (`Front_Summer_Dent/.env`)

| Variable | Requerida | Descripción |
|---|---|---|
| `VITE_BACKEND_URL` | No | URL del backend (default: `http://localhost:5000`) |

---

## 📡 Endpoints de la API

El backend expone los siguientes grupos de endpoints bajo `http://localhost:5000`:

| Ruta base | Descripción |
|---|---|
| `GET /` | Health check — verificar que la API funciona |
| `/api/auth` | Autenticación (login, registro) |
| `/api/productos` | CRUD de productos |
| `/api/inventario` | Gestión de inventario |
| `/api/doctores` | CRUD de doctores |
| `/api/pacientes` | CRUD de pacientes |
| `/api/tratamientos` | CRUD de tratamientos |
| `/api/citas` | CRUD de citas |
| `/api/movimientos-finanzas` | Movimientos financieros (ingresos/egresos) |

---

## 📜 Scripts disponibles

### Backend (`Back_Summer_Dent/`)

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor con **nodemon** (reinicio automático al guardar cambios) |
| `npm start` | Inicia el servidor con **node** (producción) |

### Frontend (`Front_Summer_Dent/`)

| Comando | Descripción |
|---|---|
| `npm run dev` | Inicia el servidor de desarrollo de Vite |
| `npm run build` | Genera el bundle de producción en `/dist` |
| `npm run preview` | Previsualiza el build de producción localmente |
| `npm run lint` | Ejecuta ESLint para revisar el código |

---

## 🤝 Contribución

1. Haz un fork del repositorio.
2. Crea una rama con tu feature: `git checkout -b feature/nueva-funcionalidad`.
3. Haz commit de tus cambios: `git commit -m 'Agregar nueva funcionalidad'`.
4. Haz push a la rama: `git push origin feature/nueva-funcionalidad`.
5. Abre un Pull Request.

---

## 📄 Licencia

ISC