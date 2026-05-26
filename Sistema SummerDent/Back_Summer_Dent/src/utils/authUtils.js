const ACCESS_COOKIE_NAME = 'summerdent_access_token';
const REFRESH_COOKIE_NAME = 'summerdent_refresh_token';

const parseCookies = (cookieHeader = '') => {
  return cookieHeader
    .split(';')
    .map((part) => part.trim())
    .filter(Boolean)
    .reduce((accumulator, part) => {
      const separatorIndex = part.indexOf('=');
      if (separatorIndex === -1) return accumulator;

      const name = decodeURIComponent(part.slice(0, separatorIndex).trim());
      const value = decodeURIComponent(part.slice(separatorIndex + 1).trim());
      accumulator[name] = value;
      return accumulator;
    }, {});
};

export const getAuthTokenFromReq = (req) => {
  const header = req?.headers?.authorization || '';
  if (header.startsWith('Bearer ')) {
    return header.replace('Bearer ', '').trim();
  }

  const cookies = parseCookies(req?.headers?.cookie || '');
  return cookies[ACCESS_COOKIE_NAME] || null;
};

export const getRefreshTokenFromReq = (req) => {
  const cookies = parseCookies(req?.headers?.cookie || '');
  return cookies[REFRESH_COOKIE_NAME] || null;
};

const isSecureCookie = () => process.env.NODE_ENV === 'production' || process.env.COOKIE_SECURE === 'true';

const buildCookieOptions = (maxAge) => ({
  httpOnly: true,
  secure: isSecureCookie(),
  sameSite: process.env.COOKIE_SAMESITE || 'lax',
  path: '/',
  maxAge
});

export const setAuthCookies = (res, { accessToken, refreshToken, accessMaxAgeMs = 60 * 60 * 1000, refreshMaxAgeMs = 30 * 24 * 60 * 60 * 1000 }) => {
  res.cookie(ACCESS_COOKIE_NAME, accessToken, buildCookieOptions(accessMaxAgeMs));
  res.cookie(REFRESH_COOKIE_NAME, refreshToken, buildCookieOptions(refreshMaxAgeMs));
};

export const clearAuthCookies = (res) => {
  const options = {
    httpOnly: true,
    secure: isSecureCookie(),
    sameSite: process.env.COOKIE_SAMESITE || 'lax',
    path: '/'
  };

  res.clearCookie(ACCESS_COOKIE_NAME, options);
  res.clearCookie(REFRESH_COOKIE_NAME, options);
};
