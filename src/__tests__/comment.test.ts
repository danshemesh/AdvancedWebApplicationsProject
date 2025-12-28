import request from 'supertest';
import app from '../app';
import Comment from '../models/comment';
import Post from '../models/post';
import User from '../models/user';
import jwt from 'jsonwebtoken';

// Mock Comment model
jest.mock('../models/comment');
const MockedComment = Comment as jest.Mocked<typeof Comment>;

// Mock Post model
jest.mock('../models/post');
const MockedPost = Post as jest.Mocked<typeof Post>;

// Mock User model
jest.mock('../models/user');
const MockedUser = User as jest.Mocked<typeof User>;

// Mock jsonwebtoken
jest.mock('jsonwebtoken');
const MockedJwt = jwt as jest.Mocked<typeof jwt>;

describe('Comments Endpoints - Unit Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockPostId = '507f1f77bcf86cd799439022';
  const mockCommentId = '507f1f77bcf86cd799439033';
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

  describe('POST /comment', () => {
    it('should create a comment successfully with authentication', async () => {
      const commentData = {
        postId: mockPostId,
        content: 'This is a test comment',
      };

      const mockPost = { _id: mockPostId, content: 'Test post' };
      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(mockPost);

      const mockSavedComment = {
        _id: mockCommentId,
        postId: commentData.postId,
        content: commentData.content,
        authorId: mockUserId,
        createdAt: new Date(),
        updatedAt: new Date(),
        save: jest.fn().mockResolvedValue(true),
      };

      (MockedComment as any).mockImplementation(() => mockSavedComment);

      const response = await request(app)
        .post('/comment')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send(commentData)
        .expect(201);

      expect(response.body).toHaveProperty('_id');
      expect(response.body.content).toBe(commentData.content);
      expect(response.body.authorId).toBe(mockUserId);
      expect(response.body.postId).toBe(mockPostId);
    });

    it('should return 401 without authentication token', async () => {
      const commentData = {
        postId: mockPostId,
        content: 'This is a test comment',
      };

      await request(app)
        .post('/comment')
        .send(commentData)
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      (MockedJwt.verify as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const commentData = {
        postId: mockPostId,
        content: 'This is a test comment',
      };

      const response = await request(app)
        .post('/comment')
        .set('Authorization', 'Bearer invalid-token')
        .send(commentData)
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 400 for missing postId', async () => {
      const response = await request(app)
        .post('/comment')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: 'Test comment' })
        .expect(400);

      expect(response.body.error).toBe('Post ID is required');
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .post('/comment')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ postId: mockPostId })
        .expect(400);

      expect(response.body.error).toBe('Content is required');
    });

    it('should return 404 when post does not exist', async () => {
      (MockedPost.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const commentData = {
        postId: mockPostId,
        content: 'Comment on non-existent post',
      };

      const response = await request(app)
        .post('/comment')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send(commentData)
        .expect(404);

      expect(response.body.error).toBe('Post not found');
    });
  });

  describe('GET /comment (by post)', () => {
    it('should get comments by post ID successfully', async () => {
      const mockComments = [
        {
          _id: mockCommentId,
          postId: mockPostId,
          content: 'Comment 1',
          authorId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
        {
          _id: '507f1f77bcf86cd799439044',
          postId: mockPostId,
          content: 'Comment 2',
          authorId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
      ];

      (MockedComment.find as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockResolvedValue(mockComments),
      });

      const response = await request(app)
        .get(`/comment?post=${mockPostId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBe(2);
      expect(MockedComment.find).toHaveBeenCalledWith({ postId: mockPostId });
    });

    it('should return 400 when post query parameter is missing', async () => {
      const response = await request(app)
        .get('/comment')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(400);

      expect(response.body.error).toBe('Post ID query parameter is required');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get(`/comment?post=${mockPostId}`)
        .expect(401);
    });
  });

  describe('GET /comment/:id', () => {
    it('should get a comment by ID successfully', async () => {
      const mockComment = {
        _id: mockCommentId,
        postId: { _id: mockPostId, content: 'Test post' },
        content: 'Test Comment',
        authorId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };

      (MockedComment.findById as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(mockComment),
        }),
      });

      const response = await request(app)
        .get(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body._id).toBe(mockCommentId);
      expect(response.body.content).toBe('Test Comment');
    });

    it('should return 404 for non-existent comment', async () => {
      (MockedComment.findById as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockResolvedValue(null),
        }),
      });

      const response = await request(app)
        .get(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Comment not found');
    });

    it('should return 400 for invalid comment ID format', async () => {
      const castError = new Error('Cast Error');
      castError.name = 'CastError';

      (MockedComment.findById as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          populate: jest.fn().mockRejectedValue(castError),
        }),
      });

      const response = await request(app)
        .get('/comment/invalid-id')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(400);

      expect(response.body.error).toBe('Invalid comment ID');
    });
  });

  describe('PUT /comment/:id', () => {
    it('should update own comment successfully', async () => {
      const updatedContent = 'Updated comment content';
      const mockComment = {
        _id: mockCommentId,
        postId: mockPostId,
        content: 'Original comment',
        authorId: { toString: () => mockUserId },
        save: jest.fn().mockResolvedValue(true),
      };

      (MockedComment.findById as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .put(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: updatedContent })
        .expect(200);

      expect(mockComment.content).toBe(updatedContent);
      expect(mockComment.save).toHaveBeenCalled();
    });

    it('should return 403 when updating another users comment', async () => {
      const otherUserId = '507f1f77bcf86cd799439099';
      const mockComment = {
        _id: mockCommentId,
        postId: mockPostId,
        content: 'Original comment',
        authorId: { toString: () => otherUserId },
      };

      (MockedComment.findById as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .put(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: 'Hacked!' })
        .expect(403);

      expect(response.body.error).toBe('You can only update your own comments');
    });

    it('should return 404 for non-existent comment', async () => {
      (MockedComment.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .put(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({ content: 'Updated' })
        .expect(404);

      expect(response.body.error).toBe('Comment not found');
    });

    it('should return 400 for missing content', async () => {
      const response = await request(app)
        .put(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .send({})
        .expect(400);

      expect(response.body.error).toBe('Content is required');
    });
  });

  describe('DELETE /comment/:id', () => {
    it('should delete own comment successfully', async () => {
      const mockComment = {
        _id: mockCommentId,
        postId: mockPostId,
        content: 'Comment to delete',
        authorId: { toString: () => mockUserId },
      };

      (MockedComment.findById as jest.Mock) = jest.fn().mockResolvedValue(mockComment);
      (MockedComment.findByIdAndDelete as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .delete(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.message).toBe('Comment deleted successfully');
      expect(MockedComment.findByIdAndDelete).toHaveBeenCalledWith(mockCommentId);
    });

    it('should return 403 when deleting another users comment', async () => {
      const otherUserId = '507f1f77bcf86cd799439099';
      const mockComment = {
        _id: mockCommentId,
        postId: mockPostId,
        content: 'Not my comment',
        authorId: { toString: () => otherUserId },
      };

      (MockedComment.findById as jest.Mock) = jest.fn().mockResolvedValue(mockComment);

      const response = await request(app)
        .delete(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(403);

      expect(response.body.error).toBe('You can only delete your own comments');
    });

    it('should return 404 for non-existent comment', async () => {
      (MockedComment.findById as jest.Mock) = jest.fn().mockResolvedValue(null);

      const response = await request(app)
        .delete(`/comment/${mockCommentId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(404);

      expect(response.body.error).toBe('Comment not found');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .delete(`/comment/${mockCommentId}`)
        .expect(401);
    });
  });
});

