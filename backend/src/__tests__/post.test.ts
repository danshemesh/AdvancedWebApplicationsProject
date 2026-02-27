import request from 'supertest';
import { Types } from 'mongoose';
import app from '../app';
import Post from '../models/post';
import User from '../models/user';
import Comment from '../models/comment';
import jwt from 'jsonwebtoken';
import { getCommentCountsForPosts, addCommentCountsToPosts } from '../controllers/post';

jest.mock('../models/post');
const MockedPost = Post as jest.Mocked<typeof Post>;

jest.mock('../models/user');
const MockedUser = User as jest.Mocked<typeof User>;

jest.mock('../models/comment');
const MockedComment = Comment as jest.Mocked<typeof Comment>;

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
    const setupPaginationMock = (mockPosts: any[], total: number, commentCounts: { _id: string; count: number }[] = []) => {
      (MockedPost.find as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            skip: jest.fn().mockReturnValue({
              limit: jest.fn().mockResolvedValue(mockPosts),
            }),
          }),
        }),
      });
      (MockedPost.countDocuments as jest.Mock) = jest.fn().mockResolvedValue(total);
      (MockedComment.aggregate as jest.Mock) = jest.fn().mockResolvedValue(commentCounts);
    };

    it('should get posts with default pagination (page 1, limit 10)', async () => {
      const mockPostData1 = {
        _id: mockPostId,
        content: 'Post 1',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPostData2 = {
        _id: '507f1f77bcf86cd799439033',
        content: 'Post 2',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = [
        { ...mockPostData1, toObject: () => mockPostData1 },
        { ...mockPostData2, toObject: () => mockPostData2 },
      ];

      setupPaginationMock(mockPosts, 2);

      const response = await request(app)
        .get('/post')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body).toHaveProperty('posts');
      expect(response.body).toHaveProperty('total', 2);
      expect(response.body).toHaveProperty('page', 1);
      expect(response.body).toHaveProperty('totalPages', 1);
      expect(response.body).toHaveProperty('hasMore', false);
      expect(Array.isArray(response.body.posts)).toBe(true);
      expect(response.body.posts.length).toBe(2);
    });

    it('should get posts with custom page and limit params', async () => {
      const mockPostData = {
        _id: '507f1f77bcf86cd799439044',
        content: 'Post 3',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = [
        { ...mockPostData, toObject: () => mockPostData },
      ];

      setupPaginationMock(mockPosts, 15);

      const response = await request(app)
        .get('/post?page=2&limit=5')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.page).toBe(2);
      expect(response.body.totalPages).toBe(3);
    });

    it('should return hasMore true when more pages exist', async () => {
      const mockPostData = {
        _id: mockPostId,
        content: 'Post',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = Array(10).fill(null).map(() => ({
        ...mockPostData,
        toObject: () => mockPostData,
      }));

      setupPaginationMock(mockPosts, 25);

      const response = await request(app)
        .get('/post?page=1&limit=10')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.hasMore).toBe(true);
      expect(response.body.totalPages).toBe(3);
    });

    it('should return hasMore false on last page', async () => {
      const mockPostData = {
        _id: mockPostId,
        content: 'Post',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = Array(5).fill(null).map(() => ({
        ...mockPostData,
        toObject: () => mockPostData,
      }));

      setupPaginationMock(mockPosts, 25);

      const response = await request(app)
        .get('/post?page=3&limit=10')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.hasMore).toBe(false);
      expect(response.body.page).toBe(3);
    });

    it('should filter posts by sender query parameter with pagination', async () => {
      const mockPostData = {
        _id: mockPostId,
        content: 'Filtered Post',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = [
        { ...mockPostData, toObject: () => mockPostData },
      ];

      setupPaginationMock(mockPosts, 1);

      const response = await request(app)
        .get(`/post?sender=${mockUserId}`)
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(MockedPost.find).toHaveBeenCalledWith({ senderId: mockUserId });
      expect(MockedPost.countDocuments).toHaveBeenCalledWith({ senderId: mockUserId });
      expect(response.body.posts).toBeDefined();
      expect(response.body.total).toBe(1);
    });

    it('should include commentCount in each post', async () => {
      const postId1 = '507f1f77bcf86cd799439022';
      const postId2 = '507f1f77bcf86cd799439033';
      const mockPostData1 = {
        _id: postId1,
        content: 'Post with comments',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPostData2 = {
        _id: postId2,
        content: 'Post with more comments',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = [
        { ...mockPostData1, toObject: () => mockPostData1 },
        { ...mockPostData2, toObject: () => mockPostData2 },
      ];
      const commentCounts = [
        { _id: postId1, count: 3 },
        { _id: postId2, count: 7 },
      ];

      setupPaginationMock(mockPosts, 2, commentCounts);

      const response = await request(app)
        .get('/post')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.posts[0]).toHaveProperty('commentCount', 3);
      expect(response.body.posts[1]).toHaveProperty('commentCount', 7);
    });

    it('should return commentCount 0 for posts with no comments', async () => {
      const mockPostData = {
        _id: mockPostId,
        content: 'Post without comments',
        senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
      };
      const mockPosts = [
        { ...mockPostData, toObject: () => mockPostData },
      ];

      setupPaginationMock(mockPosts, 1, []);

      const response = await request(app)
        .get('/post')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.posts[0]).toHaveProperty('commentCount', 0);
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

describe('Comment Count Helper Functions', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  describe('getCommentCountsForPosts', () => {
    it('should return a map of post IDs to comment counts', async () => {
      const postId1 = new Types.ObjectId();
      const postId2 = new Types.ObjectId();
      const postIds = [postId1, postId2];

      (MockedComment.aggregate as jest.Mock) = jest.fn().mockResolvedValue([
        { _id: postId1, count: 5 },
        { _id: postId2, count: 3 },
      ]);

      const result = await getCommentCountsForPosts(postIds);

      expect(MockedComment.aggregate).toHaveBeenCalledWith([
        { $match: { postId: { $in: postIds } } },
        { $group: { _id: '$postId', count: { $sum: 1 } } },
      ]);
      expect(result.get(postId1.toString())).toBe(5);
      expect(result.get(postId2.toString())).toBe(3);
    });

    it('should return empty map when no comments exist', async () => {
      const postIds = [new Types.ObjectId()];

      (MockedComment.aggregate as jest.Mock) = jest.fn().mockResolvedValue([]);

      const result = await getCommentCountsForPosts(postIds);

      expect(result.size).toBe(0);
    });

    it('should handle empty postIds array', async () => {
      (MockedComment.aggregate as jest.Mock) = jest.fn().mockResolvedValue([]);

      const result = await getCommentCountsForPosts([]);

      expect(result.size).toBe(0);
    });
  });

  describe('addCommentCountsToPosts', () => {
    it('should add comment counts to posts from map', () => {
      const postId1 = new Types.ObjectId();
      const postId2 = new Types.ObjectId();
      const posts = [
        { _id: postId1, content: 'Post 1' },
        { _id: postId2, content: 'Post 2' },
      ];
      const commentCountMap = new Map([
        [postId1.toString(), 5],
        [postId2.toString(), 3],
      ]);

      const result = addCommentCountsToPosts(posts, commentCountMap);

      expect(result[0].commentCount).toBe(5);
      expect(result[1].commentCount).toBe(3);
      expect(result[0].content).toBe('Post 1');
      expect(result[1].content).toBe('Post 2');
    });

    it('should default to 0 for posts not in the map', () => {
      const postId = new Types.ObjectId();
      const posts = [{ _id: postId, content: 'Post without comments' }];
      const commentCountMap = new Map<string, number>();

      const result = addCommentCountsToPosts(posts, commentCountMap);

      expect(result[0].commentCount).toBe(0);
    });

    it('should handle empty posts array', () => {
      const commentCountMap = new Map<string, number>();

      const result = addCommentCountsToPosts([], commentCountMap);

      expect(result).toEqual([]);
    });

    it('should preserve all original post properties', () => {
      const postId = new Types.ObjectId();
      const posts = [{
        _id: postId,
        content: 'Test',
        senderId: 'user123',
        createdAt: new Date(),
      }];
      const commentCountMap = new Map([[postId.toString(), 2]]);

      const result = addCommentCountsToPosts(posts, commentCountMap);

      expect(result[0]).toHaveProperty('_id', postId);
      expect(result[0]).toHaveProperty('content', 'Test');
      expect(result[0]).toHaveProperty('senderId', 'user123');
      expect(result[0]).toHaveProperty('createdAt');
      expect(result[0]).toHaveProperty('commentCount', 2);
    });
  });
});

