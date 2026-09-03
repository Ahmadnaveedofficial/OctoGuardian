import { Response } from 'express';

const ACCESS_TOKEN_MAX_AGE = 15 * 60 * 1000;
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000;

function cookieOptions() {
  const isProduction = process.env.NODE_ENV === 'production';
  const sameSite = process.env.COOKIE_SAME_SITE?.toLowerCase() === 'none' ? 'none' : 'lax';
  return {
    httpOnly: true,
    secure: isProduction || sameSite === 'none',
    sameSite: sameSite as 'lax' | 'none',
  };
}

export const setAuthCookies = (res: Response, accessToken: string, refreshToken: string) => {
  const common = cookieOptions();
  res.cookie('access_token', accessToken, {
    ...common,
    path: '/',
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refresh_token', refreshToken, {
    ...common,
    path: '/api/v1/auth',
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
};

export const clearAuthCookies = (res: Response) => {
  const common = cookieOptions();
  res.clearCookie('access_token', { ...common, path: '/' });
  res.clearCookie('refresh_token', { ...common, path: '/api/v1/auth' });
};
