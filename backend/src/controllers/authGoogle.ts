import { Request, Response } from 'express';
import passport from 'passport';
import { GoogleAuthResult } from '../config/passport';

const FRONTEND_URL = process.env.FRONTEND_URL || process.env.CORS_ORIGIN || 'http://localhost:5173';

export const googleAuth = (req: Request, res: Response, next: () => void) => {
  if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
    const error = encodeURIComponent('Google sign-in is not configured');
    res.redirect(`${FRONTEND_URL}/login?error=${error}`);
    return;
  }
  passport.authenticate('google', { scope: ['profile', 'email'] })(req, res, next);
};

export const googleCallback = (req: Request, res: Response, next: () => void) => {
  passport.authenticate(
    'google',
    { session: false },
    (err: Error | null, result: GoogleAuthResult | undefined) => {
      if (err || !result) {
        const error = encodeURIComponent(err?.message || 'Google sign-in failed');
        res.redirect(`${FRONTEND_URL}/login?error=${error}`);
        return;
      }
      const params = new URLSearchParams({
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
      });
      res.redirect(`${FRONTEND_URL}/login?${params.toString()}`);
    }
  )(req, res, next);
};
