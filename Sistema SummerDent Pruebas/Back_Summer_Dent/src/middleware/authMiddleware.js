
import jwt from 'jsonwebtoken';

const jwtSecret = process.env.SUPABASE_JWT_SECRET || process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!jwtSecret) {
  // Not throwing here so app can start in environments where middleware isn't used yet
  console.warn('Warning: SUPABASE_JWT_SECRET or SUPABASE_SERVICE_ROLE_KEY not set. authMiddleware will reject tokens.');
}

export const verifyToken = (req, res, next) => {
  const header = req.headers.authorization || '';
  if (!header.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Token no proporcionado' });
  }

  const token = header.replace('Bearer ', '').trim();

  try {
    if (!jwtSecret) throw new Error('JWT secret no configurado');
    const payload = jwt.verify(token, jwtSecret, { algorithms: ['HS256'] });
    req.user = payload; // payload.sub is el user id en Supabase
    return next();
  } catch (err) {
    return res.status(401).json({ error: 'Token inválido o expirado' });
  }
};

export const requireRole = (role) => (req, res, next) => {
  // Ensure token verified first
  verifyToken(req, res, () => {
    const userRole = req.user?.role || req.user?.['role'];
    if (!role) return next();
    if (userRole === role) return next();
    return res.status(403).json({ error: 'Acceso denegado: rol insuficiente' });
  });
};

export default { verifyToken, requireRole };
