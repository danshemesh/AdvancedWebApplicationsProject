import request from 'supertest';
import app from '../app';
import Post from '../models/post';
import User from '../models/user';
import jwt from 'jsonwebtoken';

// Mock Post model
jest.mock('../models/post');
const MockedPost = Post as jest.Mocked<typeof Post>;

// Mock User model
jest.mock('../models/user');
const MockedUser = User as jest.Mocked<typeof User>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const MockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Posts Endpoints - Unit Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockPostId = '507f1f77bcf86cd799439022';
  const mockAccessToken = 'mock-access-token';

  const mockUser = {
    _id: mockUserId,
    username: 'testuser',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup default auth mock - verify token and find user
    (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue({ userId: mockUserId });
    (MockedUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });
  });

  describe('POST /post', () => {
    it('should create a post successfully with authentication', async () => {
      const postData = { content: 'This is a test post' };

      const mockSavedPost = {
        _id: mockPostId,
        content: postData.content,
        senderId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      (MockedPost as any).mockImplementation(() => mockSavedPost);

      const response = await request(app)
        .post('/post')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send(postData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.content).toBe(postData.content);
      expect(response.body.senderId).toBe(mockUserId);
    });

    it('should return 401 without authentication token', async () => {
      const postData = { content: 'This is a test post' };

      await request(app)
        .post('/post')
        .send(postData)
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      (MockedJwt.verify as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const postData = { content: 'This is a test post' };

      const response = await request(app)
        .post('/post')
        .set('Authorization', 'Bearer invalid-token')
        .send(postData)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .post('/post')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Content is required');
    });
  });

  describe('GET /post', () => {
    it('should get all posts successfully', async () => {
      const mockPosts = [
        {
          _id: mockPostId,
          content: 'Post 1',
          senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
        {
          _id: '507f1f77bcf86cd799439033',
          content: 'Post 2',
          senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
      ];

      (MockedPost.find as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPosts),
      });

      const response = await request(app)
        .get('/post')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
    });

    it('should filter posts by sender query parameter', async () => {
      const mockPosts = [
        {
          _id: mockPostId,
          content: 'Filtered Post',
          senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
      ];

      (MockedPost.find as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPosts),
      });

      const response = await request(app)
        .get(`/post?sender=${mockUserId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(MockedPost.find).toHaveBeenCalledWith({ senderId: mockUserId });
      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/post')
        .expect(401);
    });
  });

  describe('GET /post/:id', () => {
    it('should get a post by ID successfully', async () => {
      const mockPost = {
        _id: mockPostId,
        content: 'Test Post',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };

      (MockedPost.findById as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockPost),
      });

      const response = await request(app)
        .get(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body._id).toBe(mockPostId);
      expect(response.body.content).toBe('Test Post');
    });

    it('should return 404 for non-existent post', async () => {
      (MockedPost.findById as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(null),
      });

      const response = await request(app)
        .get(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });

    it('should return 400 for invalid post ID format', async () => {
      const castError = new Error('Cast Error');
      castError.name = 'CastError';

      (MockedPost.findById as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockRejectedValue(castError),
      });

      const response = await request(app)
        .get('/post/invalid-id')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(400);

      expect(response.body.error).toBe('Invalid post ID');
    });
  });

  describe('PUT /post/:id', () => {
    it('should update own post successfully', async () => {
      const updatedContent = 'Updated content';
      const mockPost = {
        _id: mockPostId,
        content: 'Original content',
        senderId: { toString: () => mockUserId },
        save: jest.fn().mockResolvedValue(true),
      };

      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(mockPost);

      const response = await request(app)
        .put(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: updatedContent })
        .expect(200);

      expect(mockPost.content).toBe(updatedContent);
      expect(mockPost.save).toHaveBeenCalled();
    });

    it('should return 403 when updating another users post', async () => {
      const otherUserId = '507f1f77bcf86cd799439099';
      const mockPost = {
        _id: mockPostId,
        content: 'Original content',
        senderId: { toString: () => otherUserId },
      };

      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(mockPost);

      const response = await request(app)
        .put(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: 'Hacked!' })
        .expect(403);

      expect(response.body.error).toBe('You can only update your own posts');
    });

    it('should return 404 for non-existent post', async () => {
      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: 'Updated' })
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .put(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Content is required');
    });
  });

  describe('DELETE /post/:id', () => {
    it('should delete own post successfully', async () => {
      const mockPost = {
        _id: mockPostId,
        content: 'Post to delete',
        senderId: { toString: () => mockUserId },
      };

      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(mockPost);
      (MockedPost.findByIdAndDelete as jest.Mock) = jest.fn().mockResolvedValue(mockPost);

      const response = await request(app)
        .delete(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Post deleted successfully');
      expect(MockedPost.findByIdAndDelete).toHaveBeenCalledWith(mockPostId);
    });

    it('should return 403 when deleting another users post', async () => {
      const otherUserId = '507f1f77bcf86cd799439099';
      const mockPost = {
        _id: mockPostId,
        content: 'Not my post',
        senderId: { toString: () => otherUserId },
      };

      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(mockPost);

      const response = await request(app)
        .delete(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(403);

      expect(response.body.error).toBe('You can only delete your own posts');
    });

    it('should return 404 for non-existent post', async () => {
      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete(`/post/${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .delete(`/post/${mockPostId}`)
        .expect(401);
    });
  });
});

