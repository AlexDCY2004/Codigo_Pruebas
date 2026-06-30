//Rama Alex

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import helmet from 'helmet';
import rateLimit from 'express-rate-limit';
import slowDown from 'express-slow-down';
import {xss} from 'express-xss-sanitizer';

import { dbConnectSupabase, sequelize } from './src/configuracionesDB/database.js';
import authRoute from './src/routes/authRoute.js';
import productoRoute from './src/routes/productoRoute.js';
import doctorRoute from './src/routes/doctorRoute.js';
import pacienteRoute from './src/routes/pacienteRoute.js';
import tratamientoRoute from './src/routes/tratamientoRoute.js';
import citaRoute from './src/routes/citaRoute.js';
import movimientoFinanzasRoute from './src/routes/movimientoFinanzasRoute.js';
import sedeRoute from './src/routes/sedeRoute.js';

dotenv.config();

const app = express();

// If running behind a proxy (Render, Heroku), enable trust proxy so
// rate-limit and secure cookies use the correct client IP and scheme.
if (process.env.TRUST_PROXY === 'true' || process.env.NODE_ENV === 'production') {
    app.set('trust proxy', 1);
}

const envOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const isProduction = process.env.NODE_ENV === 'production';
// Toggle to require Origin header in production. Default: false (allow health checks, load balancer pings)
const requireOrigin = process.env.REQUIRE_ORIGIN === 'true';

// In production only envOrigins are trusted. In development allow localhost convenience origins.
const allowedOrigins = new Set([...envOrigins]);
if (!isProduction) {
    allowedOrigins.add('http://localhost:5173');
    allowedOrigins.add('http://localhost:3000');
}

app.use(
    cors({
        origin: (origin, callback) => {
                // In production: if REQUIRE_ORIGIN is set, require Origin header; otherwise allow missing Origin
                if (isProduction) {
                    if (!origin) {
                        if (requireOrigin) return callback(new Error('Origin header requerido en producción'));
                        // allow missing Origin (common for health checks / server pings)
                        return callback(null, true);
                    }

                    if (allowedOrigins.has(origin)) return callback(null, true);
                    return callback(new Error(`Origen no permitido por CORS: ${origin}`));
                }

                // Development behavior: allow missing Origin (Postman/CLI) and localhost prefixes for convenience
                if (!origin) return callback(null, true);

                if (
                    allowedOrigins.has(origin) ||
                    origin.startsWith('http://localhost') ||
                    origin.startsWith('http://127.0.0.1') ||
                    origin.startsWith('https://localhost') ||
                    origin.startsWith('https://127.0.0.1')
                ) {
                    return callback(null, true);
                }

                return callback(new Error(`Origen no permitido por CORS: ${origin}`));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    })
);

// Stricter rate limit for auth endpoints to mitigate brute-force
const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 6, // limit each IP to 6 login attempts per window
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiados intentos de autenticación. Intenta más tarde.'
});
app.use('/api/auth/login', authLimiter);
app.use('/api/auth/registro', authLimiter);

// Security: limit body size to mitigate large payload DoS attempts
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: false, limit: '10kb' }));

// Use Helmet to set secure HTTP headers
app.use(helmet());

// Basic XSS cleaning middleware for request bodies
app.use(xss());

// Global rate limiter (very permissive for normal usage)
const globalLimiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 200, // limit each IP to 200 requests per windowMs
    standardHeaders: true,
    legacyHeaders: false,
    message: 'Demasiadas solicitudes, por favor intenta de nuevo más tarde.'
});
app.use(globalLimiter);

// Slow down aggressive clients to mitigate DoS
const speedLimiter = slowDown({
    windowMs: 60 * 1000, // 1 minute
    delayAfter: 50, // allow 50 requests per minute, then start delaying
    delayMs: () => 500 // express-slow-down v3 uses the new fixed-delay format
});
app.use(speedLimiter);

app.get('/', (req, res) => {
    res.json({ message: 'Summer Dent API funcionando correctamente' });
});

app.use('/api/auth', authRoute);
app.use('/api/productos', productoRoute);
app.use('/api/doctores', doctorRoute);
app.use('/api/pacientes', pacienteRoute);
app.use('/api/tratamientos', tratamientoRoute);
app.use('/api/citas', citaRoute);
app.use('/api/movimientos-finanzas', movimientoFinanzasRoute);
app.use('/api/sedes', sedeRoute);

const PORT = Number(process.env.PORT || 5000);

const startServer = async () => {
    try {
        // Usar Supabase (PostgREST) para las operaciones; Sequelize es opcional.
        // Si necesitas Sequelize, pon USE_SEQUELIZE=true en tu .env
        if (process.env.USE_SEQUELIZE === 'true') {
            await dbConnectSupabase();
            await sequelize.sync();
        } else {
            console.log('Iniciando sin Sequelize (usando Supabase).');
        }

        app.listen(PORT, () => {
            console.log(`Servidor corriendo en el puerto ${PORT}`);
        });
    } catch (error) {
        console.error('No se pudo iniciar el servidor:', error.message || error);
        process.exit(1);
    }
};

startServer();

export default app;