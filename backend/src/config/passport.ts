import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import User from '../models/user';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import crypto from 'crypto';

const ACCESS_TOKEN_EXPIRY = process.env.ACCESS_TOKEN_EXPIRY || '15m';
const REFRESH_TOKEN_EXPIRY = process.env.REFRESH_TOKEN_EXPIRY || '7d';

const generateTokens = (userId: string) => {
  const jwtSecret = process.env.JWT_SECRET!;
  const refreshSecret = process.env.JWT_REFRESH_SECRET!;
  const accessToken = jwt.sign({ userId }, jwtSecret, { expiresIn: ACCESS_TOKEN_EXPIRY } as jwt.SignOptions);
  const refreshToken = jwt.sign({ userId }, refreshSecret, { expiresIn: REFRESH_TOKEN_EXPIRY } as jwt.SignOptions);
  return { accessToken, refreshToken };
};

export type GoogleAuthResult = {
  user: Record<string, unknown>;
  accessToken: string;
  refreshToken: string;
};

type GoogleVerify = (
  accessToken: string,
  refreshToken: string,
  profile: import('passport-google-oauth20').Profile,
  done: import('passport-google-oauth20').VerifyCallback
) => void;

async function ensureUniqueUsername(base: string): Promise<string> {
  let username = base;
  let n = 0;
  while (await User.findOne({ username })) {
    username = `${base}${++n}`.slice(0, 30);
  }
  return username;
}

if (process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: process.env.GOOGLE_CLIENT_ID,
        clientSecret: process.env.GOOGLE_CLIENT_SECRET,
        callbackURL:
          process.env.GOOGLE_CALLBACK_URL ||
          `http://localhost:${process.env.PORT || 3000}/auth/google/callback`,
      },
      (async (_accessToken, _refreshToken, profile, done) => {
        try {
          const googleId = profile.id;
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error('Google account has no email address'));

          const displayName = profile.displayName || profile.name?.givenName || email.split('@')[0];
          const usernameBase = displayName.replace(/\s+/g, '').slice(0, 25) || 'user';

          let user = await User.findOne({ $or: [{ googleId }, { email }] }).select('+password');

          if (user) {
            if (!user.googleId) {
              user.googleId = googleId;
              await user.save();
            }
          } else {
            const username = await ensureUniqueUsername(usernameBase);
            const password = await bcrypt.hash(crypto.randomBytes(32).toString('hex'), 10);
            user = new User({ username, email, password, googleId });
            await user.save();
          }

          const { accessToken, refreshToken } = generateTokens(user._id.toString());
          user.refreshToken = refreshToken;
          await user.save({ validateBeforeSave: false });

          const sanitized = user.toObject() as unknown as Record<string, unknown>;
          delete sanitized.password;
          delete sanitized.refreshToken;

          return (done as unknown as (err: null, result: GoogleAuthResult) => void)(null, { user: sanitized, accessToken, refreshToken });
        } catch (err) {
          return done(err as Error);
        }
      }) as GoogleVerify
    )
  );
}

export default passport;
