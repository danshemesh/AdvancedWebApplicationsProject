import request from 'supertest';
import app from '../app';
import User from '../models/user';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// Mock User model
jest.mock('../models/user');
const MockedUser = User as jest.MockedClass<typeof User>;

// Mock bcrypt
jest.mock('bcryptjs');
const MockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const MockedJwt = jwt as jest.Mocked<typeof jwt>;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';
const JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key';

describe('Authentication Endpoints - Unit Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockAccessToken = 'mock-access-token';
  const mockRefreshToken = 'mock-refresh-token';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('POST /auth/register', () => {
    it('should register a new user successfully', async () => {
      const userData = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockResolvedValue(null);
      (MockedBcrypt.hash as jest.Mock) = jest.fn().mockResolvedValue('hashedpassword');
      (MockedJwt.sign as jest.Mock) = jest.fn()
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const mockSavedUser = {
        _id: mockUserId,
        username: userData.username,
        email: userData.email,
        password: 'hashedpassword',
        refreshToken: mockRefreshToken,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          username: userData.username,
          email: userData.email,
        }),
      };

      (MockedUser as any).mockImplementation(() => mockSavedUser);

      const response = await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(201);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.username).toBe(userData.username);
      expect(response.body.user.email).toBe(userData.email);
      expect(response.body.user).not.toHaveProperty('password');
      expect(MockedBcrypt.hash).toHaveBeenCalledWith(userData.password, 10);
      expect(MockedJwt.sign).toHaveBeenCalledTimes(2);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app)
        .post('/auth/register')
        .send({ username: 'test' })
        .expect(400);
    });

    it('should return 400 for password too short', async () => {
      const userData = {
        username: 'testuser',
        email: 'test@example.com',
        password: '12345', // Less than 6 characters
      };

      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should return 400 for duplicate email', async () => {
      const userData = {
        username: 'newuser',
        email: 'existing@example.com',
        password: 'password123',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockResolvedValue({ _id: mockUserId });

      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });

    it('should return 400 for duplicate username', async () => {
      const userData = {
        username: 'existinguser',
        email: 'new@example.com',
        password: 'password123',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockResolvedValue({ _id: mockUserId });

      await request(app)
        .post('/auth/register')
        .send(userData)
        .expect(400);
    });
  });

  describe('POST /auth/login', () => {
    it('should login with valid credentials', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'password123',
      };

      const mockUser = {
        _id: mockUserId,
        username: 'testuser',
        email: loginData.email,
        password: 'hashedpassword',
        refreshToken: 'old-refresh-token',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          username: 'testuser',
          email: loginData.email,
        }),
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      (MockedBcrypt.compare as jest.Mock) = jest.fn().mockResolvedValue(true);
      (MockedJwt.sign as jest.Mock) = jest.fn()
        .mockReturnValueOnce(mockAccessToken)
        .mockReturnValueOnce(mockRefreshToken);

      const response = await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(200);

      expect(response.body).toHaveProperty('user');
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.email).toBe(loginData.email);
      expect(MockedBcrypt.compare).toHaveBeenCalledWith(loginData.password, mockUser.password);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 401 for invalid email', async () => {
      const loginData = {
        email: 'wrong@example.com',
        password: 'password123',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should return 401 for invalid password', async () => {
      const loginData = {
        email: 'test@example.com',
        password: 'wrongpassword',
      };

      const mockUser = {
        _id: mockUserId,
        email: loginData.email,
        password: 'hashedpassword',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUser),
      });
      (MockedBcrypt.compare as jest.Mock) = jest.fn().mockResolvedValue(false);

      await request(app)
        .post('/auth/login')
        .send(loginData)
        .expect(401);
    });

    it('should return 400 for missing email', async () => {
      await request(app)
        .post('/auth/login')
        .send({ password: 'password123' })
        .expect(400);
    });

    it('should return 400 for missing password', async () => {
      await request(app)
        .post('/auth/login')
        .send({ email: 'test@example.com' })
        .expect(400);
    });
  });

  describe('POST /auth/logout', () => {
    it('should logout successfully with valid refresh token', async () => {
      const refreshToken = mockRefreshToken;
      const decoded = { userId: mockUserId };

      (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue(decoded);

      const mockUser = {
        _id: mockUserId,
        refreshToken: refreshToken,
        save: jest.fn().mockResolvedValue(true),
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

      const response = await request(app)
        .post('/auth/logout')
        .send({ refreshToken })
        .expect(200);

      expect(response.body.message).toBe('Logout successful');
      expect(mockUser.refreshToken).toBeUndefined();
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 400 for missing refresh token', async () => {
      await request(app)
        .post('/auth/logout')
        .send({})
        .expect(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      (MockedJwt.verify as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await request(app)
        .post('/auth/logout')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });
  });

  describe('POST /auth/refresh', () => {
    it('should refresh tokens successfully', async () => {
      const refreshToken = mockRefreshToken;
      const decoded = { userId: mockUserId };
      const newAccessToken = 'new-access-token';
      const newRefreshToken = 'new-refresh-token';

      (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue(decoded);

      const mockUser = {
        _id: mockUserId,
        refreshToken: refreshToken,
        save: jest.fn().mockResolvedValue(true),
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUser);
      (MockedJwt.sign as jest.Mock) = jest.fn()
        .mockReturnValueOnce(newAccessToken)
        .mockReturnValueOnce(newRefreshToken);

      const response = await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(200);

      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.refreshToken).toBe(newRefreshToken);
      expect(mockUser.save).toHaveBeenCalled();
    });

    it('should return 400 for missing refresh token', async () => {
      await request(app)
        .post('/auth/refresh')
        .send({})
        .expect(400);
    });

    it('should return 401 for invalid refresh token', async () => {
      (MockedJwt.verify as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new Error('Invalid token');
      });

      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken: 'invalid-token' })
        .expect(401);
    });

    it('should return 401 if refresh token does not match stored token', async () => {
      const refreshToken = mockRefreshToken;
      const decoded = { userId: mockUserId };

      (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue(decoded);

      const mockUser = {
        _id: mockUserId,
        refreshToken: 'different-token',
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUser);

      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });

    it('should return 401 for non-existent user', async () => {
      const refreshToken = mockRefreshToken;
      const decoded = { userId: 'nonexistent-id' };

      (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue(decoded);
      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      await request(app)
        .post('/auth/refresh')
        .send({ refreshToken })
        .expect(401);
    });
  });
});
