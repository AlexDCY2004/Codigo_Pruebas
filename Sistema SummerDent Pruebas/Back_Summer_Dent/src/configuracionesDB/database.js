import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import supabase from './supabaseClient.js';
dotenv.config();

// Preferir URL de conexión (SUPABASE_DB_URL). Si no está, usa parámetros individuales.
const connectionString = process.env.SUPABASE_DB_URL || null;

const buildOptions = (ssl) => {
	const base = {
		dialect: 'postgres',
		logging: false
	};

	if (ssl) {
		base.dialectOptions = {
			ssl: {
				require: true,
				rejectUnauthorized: false
			}
		};
	}

	return base;
};

const safeString = (v) => (v === undefined || v === null ? '' : String(v));

const createSequelize = (ssl = true) =>
	connectionString
		? new Sequelize(connectionString, buildOptions(ssl))
		: new Sequelize(
				safeString(process.env.SUPABASE_DB_NAME || process.env.DB_NAME),
				safeString(process.env.SUPABASE_DB_USER || process.env.DB_USER),
				safeString(process.env.SUPABASE_DB_PASS || process.env.DB_PASS),
				Object.assign(
					{
						host: safeString(process.env.SUPABASE_DB_HOST || process.env.DB_HOST),
						port: Number(process.env.SUPABASE_DB_PORT || process.env.DB_PORT || 5432)
					},
					buildOptions(ssl)
				)
		  );

// Exportamos `sequelize` como let para poder reasignarlo si necesitamos reintentar sin SSL
export let sequelize = createSequelize(true);

export const dbConnectSupabase = async () => {
	try {
		await sequelize.authenticate();
		console.log('Conexión exitosa a Supabase (Postgres) usando Sequelize.');
		if (supabase) console.log('Cliente Supabase disponible.');
	} catch (err) {
		const msg = String(err?.message || err).toLowerCase();
		console.error('Error de conexión a Supabase:', err.message || err);

		// Si el servidor no soporta SSL, reintentamos sin SSL
		if (msg.includes('does not support ssl') || msg.includes('server does not support ssl') || msg.includes('the server does not support ssl')) {
			console.warn('Servidor no soporta SSL — reintentando conexión sin SSL');
			try {
				sequelize = createSequelize(false);
				await sequelize.authenticate();
				console.log('Conexión exitosa sin SSL (fallback).');
				if (supabase) console.log('Cliente Supabase disponible.');
				return;
			} catch (err2) {
				console.error('Reintento sin SSL fallido:', err2.message || err2);
				throw err2;
			}
		}

		throw err;
	}
};

export { supabase };
export default sequelize;

