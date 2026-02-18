import request from 'supertest';
import app from '../app';
import User from '../models/user';
import jwt from 'jsonwebtoken';

// Mock User model
jest.mock('../models/user');
const MockedUser = User as jest.MockedClass<typeof User>;

// Mock auth middleware
jest.mock('../middleware/auth', () => ({
  authenticateToken: (req: any, res: any, next: any) => {
    const authHeader = req.headers['authorization'];
    const token = authHeader && authHeader.split(' ')[1];
    
    if (!token || token === 'invalid-token') {
      return res.status(401).json({ error: 'Access token required' });
    }
    
    // Mock authenticated user
    req.user = {
      id: '507f1f77bcf86cd799439011',
      username: 'testuser',
      email: 'test@example.com',
    };
    next();
  },
}));

// Mock upload middleware - inject req.file when X-Inject-Avatar header is set (so we don't touch filesystem)
jest.mock('../middleware/upload', () => ({
  uploadAvatar: (req: any, res: any, next: any) => {
    if (req.headers['x-inject-avatar'] === 'yes') {
      req.file = {
        fieldname: 'avatar',
        originalname: 'avatar.jpg',
        encoding: '7bit',
        mimetype: 'image/jpeg',
        size: 1024,
        destination: 'uploads/avatars',
        filename: '507f1f77bcf86cd799439011-1234567890.jpg',
        path: 'uploads/avatars/507f1f77bcf86cd799439011-1234567890.jpg',
      };
    }
    next();
  },
}));

// Mock bcrypt
jest.mock('bcryptjs');
import bcrypt from 'bcryptjs';
const MockedBcrypt = bcrypt as jest.Mocked<typeof bcrypt>;

const JWT_SECRET = process.env.JWT_SECRET || 'your-secret-key';

describe('User CRUD Endpoints - Unit Tests', () => {
  let accessToken: string;
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockUserData = {
    _id: mockUserId,
    username: 'testuser',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Generate access token
    accessToken = jwt.sign({ userId: mockUserId }, JWT_SECRET, { expiresIn: '15m' });
  });

  describe('GET /user', () => {
    it('should get all users with valid token', async () => {
      const mockUsers = [mockUserData, { _id: '507f1f77bcf86cd799439012', username: 'user2', email: 'user2@example.com' }];

      (MockedUser.find as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUsers),
      });

      const response = await request(app)
        .get('/user')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(response.body[0]).not.toHaveProperty('password');
      expect(response.body[0]).not.toHaveProperty('refreshToken');
      expect(MockedUser.find).toHaveBeenCalled();
    });

    it('should return 401 without token', async () => {
      await request(app)
        .get('/user')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      await request(app)
        .get('/user')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);
    });
  });

  describe('GET /user/:id', () => {
    it('should get user by ID with valid token', async () => {
      (MockedUser.findById as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(mockUserData),
      });

      const response = await request(app)
        .get(`/user/${mockUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(response.body._id).toBe(mockUserId);
      expect(response.body).not.toHaveProperty('password');
      expect(response.body).not.toHaveProperty('refreshToken');
      expect(MockedUser.findById).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 404 for non-existent user', async () => {
      (MockedUser.findById as jest.Mock) = jest.fn().mockReturnValue({
        select: jest.fn().mockResolvedValue(null),
      });

      await request(app)
        .get(`/user/${mockUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app)
        .get('/user/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .get(`/user/${mockUserId}`)
        .expect(401);
    });
  });

  describe('POST /user', () => {
    it('should create a new user with valid data', async () => {
      const newUser = {
        username: 'newuser',
        email: 'newuser@example.com',
        password: 'password123',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockResolvedValue(null);
      (MockedBcrypt.hash as jest.Mock) = jest.fn().mockResolvedValue('hashedpassword');
      
      const mockSavedUser = {
        _id: mockUserId,
        username: newUser.username,
        email: newUser.email,
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          username: newUser.username,
          email: newUser.email,
        }),
        save: jest.fn().mockResolvedValue(true),
      };
      
      (MockedUser as any).mockImplementation(() => mockSavedUser);

      const response = await request(app)
        .post('/user')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newUser)
        .expect(201);

      expect(response.body.username).toBe(newUser.username);
      expect(response.body.email).toBe(newUser.email);
      expect(response.body).not.toHaveProperty('password');
      expect(MockedBcrypt.hash).toHaveBeenCalledWith(newUser.password, 10);
    });

    it('should return 400 for missing required fields', async () => {
      await request(app)
        .post('/user')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'test' })
        .expect(400);
    });

    it('should return 400 for duplicate email', async () => {
      const newUser = {
        username: 'anotheruser',
        email: 'test@example.com',
        password: 'password123',
      };

      (MockedUser.findOne as jest.Mock) = jest.fn().mockResolvedValue({ _id: mockUserId });

      await request(app)
        .post('/user')
        .set('Authorization', `Bearer ${accessToken}`)
        .send(newUser)
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .post('/user')
        .send({
          username: 'test',
          email: 'test@test.com',
          password: 'password123',
        })
        .expect(401);
    });
  });

  describe('PUT /user/:id', () => {
    it('should update another user (non-self) with username and email', async () => {
      const otherUserId = '507f1f77bcf86cd799439012';
      const updateData = {
        username: 'updateduser',
        email: 'updated@example.com',
      };

      const mockUserToUpdate = {
        _id: otherUserId,
        username: updateData.username,
        email: updateData.email,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: otherUserId,
          username: updateData.username,
          email: updateData.email,
        }),
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUserToUpdate);

      const response = await request(app)
        .put(`/user/${otherUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.username).toBe(updateData.username);
      expect(response.body.email).toBe(updateData.email);
      expect(response.body).not.toHaveProperty('password');
      expect(mockUserToUpdate.save).toHaveBeenCalled();
    });

    it('should update password when provided (only for non-self update)', async () => {
      const otherUserId = '507f1f77bcf86cd799439012';
      const updateData = {
        password: 'newpassword123',
      };

      const mockUserToUpdate = {
        _id: otherUserId,
        username: 'otheruser',
        email: 'other@example.com',
        password: 'oldhashed',
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: otherUserId,
          username: 'otheruser',
          email: 'other@example.com',
        }),
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUserToUpdate);
      (MockedBcrypt.hash as jest.Mock) = jest.fn().mockResolvedValue('newhashedpassword');

      await request(app)
        .put(`/user/${otherUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(MockedBcrypt.hash).toHaveBeenCalledWith(updateData.password, 10);
      expect(mockUserToUpdate.password).toBe('newhashedpassword');
    });

    it('when updating own profile (same id as token), only username is updated; email and password are ignored', async () => {
      const updateData = {
        username: 'newname',
        email: 'hacker@evil.com',
        password: 'newpassword123',
      };

      const mockUserToUpdate = {
        ...mockUserData,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          username: 'newname',
          email: 'test@example.com',
        }),
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUserToUpdate);

      const response = await request(app)
        .put(`/user/${mockUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send(updateData)
        .expect(200);

      expect(response.body.username).toBe('newname');
      expect(response.body.email).toBe('test@example.com');
      expect(MockedBcrypt.hash).not.toHaveBeenCalled();
    });

    it('should return 404 for non-existent user', async () => {
      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      await request(app)
        .put(`/user/${mockUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'test' })
        .expect(404);
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app)
        .put('/user/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ username: 'test' })
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .put(`/user/${mockUserId}`)
        .send({ username: 'test' })
        .expect(401);
    });
  });

  describe('PUT /user/:id/avatar', () => {
    it('should upload avatar and return user when own id and file provided', async () => {
      const mockUserToUpdate = {
        ...mockUserData,
        profilePicturePath: undefined,
        save: jest.fn().mockResolvedValue(true),
        toObject: jest.fn().mockReturnValue({
          _id: mockUserId,
          username: 'testuser',
          email: 'test@example.com',
          profilePicturePath: 'avatars/507f1f77bcf86cd799439011-1234567890.jpg',
        }),
      };

      (MockedUser.findById as jest.Mock) = jest.fn().mockResolvedValue(mockUserToUpdate);

      const response = await request(app)
        .put(`/user/${mockUserId}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Inject-Avatar', 'yes')
        .expect(200);

      expect(response.body.profilePicturePath).toBe('avatars/507f1f77bcf86cd799439011-1234567890.jpg');
      expect(mockUserToUpdate.save).toHaveBeenCalled();
    });

    it('should return 403 when updating another user avatar', async () => {
      const otherUserId = '507f1f77bcf86cd799439012';

      await request(app)
        .put(`/user/${otherUserId}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .set('X-Inject-Avatar', 'yes')
        .expect(403);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .put(`/user/${mockUserId}/avatar`)
        .set('X-Inject-Avatar', 'yes')
        .expect(401);
    });

    it('should return 400 when no file provided', async () => {
      await request(app)
        .put(`/user/${mockUserId}/avatar`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });
  });

  describe('DELETE /user/:id', () => {
    it('should delete user with valid ID', async () => {
      (MockedUser.findByIdAndDelete as jest.Mock) = jest.fn().mockResolvedValue(mockUserData);

      await request(app)
        .delete(`/user/${mockUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(200);

      expect(MockedUser.findByIdAndDelete).toHaveBeenCalledWith(mockUserId);
    });

    it('should return 404 for non-existent user', async () => {
      (MockedUser.findByIdAndDelete as jest.Mock) = jest.fn().mockResolvedValue(null);

      await request(app)
        .delete(`/user/${mockUserId}`)
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(404);
    });

    it('should return 400 for invalid ID format', async () => {
      await request(app)
        .delete('/user/invalid-id')
        .set('Authorization', `Bearer ${accessToken}`)
        .expect(400);
    });

    it('should return 401 without token', async () => {
      await request(app)
        .delete(`/user/${mockUserId}`)
        .expect(401);
    });
  });
});
