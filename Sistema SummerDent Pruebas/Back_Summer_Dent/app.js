//Rama Alex

import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

import { dbConnectSupabase, sequelize } from './src/configuracionesDB/database.js';
import authRoute from './src/routes/authRoute.js';
import productoRoute from './src/routes/productoRoute.js';
import inventarioRoute from './src/routes/inventarioRoute.js';
import doctorRoute from './src/routes/doctorRoute.js';
import pacienteRoute from './src/routes/pacienteRoute.js';
import tratamientoRoute from './src/routes/tratamientoRoute.js';
import citaRoute from './src/routes/citaRoute.js';
import movimientoFinanzasRoute from './src/routes/movimientoFinanzasRoute.js';

dotenv.config();

const app = express();

const envOrigins = (process.env.FRONTEND_URL || '')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

const allowedOrigins = new Set([
    'http://localhost:5173',
    'http://localhost:3000',
    ...envOrigins
]);

app.use(
    cors({
        origin: (origin, callback) => {
            // Allow requests without Origin header (Postman, server-to-server).
            if (!origin || allowedOrigins.has(origin)) {
                return callback(null, true);
            }

            return callback(new Error(`Origen no permitido por CORS: ${origin}`));
        },
        methods: ['GET', 'POST', 'PUT', 'DELETE'],
        allowedHeaders: ['Content-Type', 'Authorization'],
        credentials: true
    })
);

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'Summer Dent API funcionando correctamente' });
});

app.use('/api/auth', authRoute);
app.use('/api/productos', productoRoute);
app.use('/api/inventario', inventarioRoute);
app.use('/api/doctores', doctorRoute);
app.use('/api/pacientes', pacienteRoute);
app.use('/api/tratamientos', tratamientoRoute);
app.use('/api/citas', citaRoute);
app.use('/api/movimientos-finanzas', movimientoFinanzasRoute);

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