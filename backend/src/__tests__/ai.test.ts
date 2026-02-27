import request from 'supertest';
import app from '../app';
import Post from '../models/post';
import User from '../models/user';
import jwt from 'jsonwebtoken';
import { checkRateLimit, buildSearchPrompt, parseRelevantPostIds } from '../controllers/ai';

jest.mock('../models/post');
const MockedPost = Post as jest.Mocked<typeof Post>;

jest.mock('../models/user');
const MockedUser = User as jest.Mocked<typeof User>;

jest.mock('jsonwebtoken');
const MockedJwt = jwt as jest.Mocked<typeof jwt>;

const mockCreate = jest.fn();
jest.mock('openai', () => {
  return jest.fn().mockImplementation(() => ({
    chat: {
      completions: {
        create: mockCreate,
      },
    },
  }));
});

describe('AI Search Endpoints - Unit Tests', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockAccessToken = 'mock-access-token';
  const originalEnv = process.env;

  const mockUser = {
    _id: mockUserId,
    username: 'testuser',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();

    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };

    (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue({ userId: mockUserId });
    (MockedUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue(mockUser),
    });

    mockCreate.mockReset();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  describe('GET /ai/search', () => {
    const setupPostsMock = (posts: any[]) => {
      (MockedPost.find as jest.Mock) = jest.fn().mockReturnValue({
        populate: jest.fn().mockReturnValue({
          sort: jest.fn().mockReturnValue({
            limit: jest.fn().mockReturnValue({
              lean: jest.fn().mockResolvedValue(posts),
            }),
          }),
        }),
      });
    };

    it('should return matching posts on successful search', async () => {
      const mockPosts = [
        {
          _id: 'post1',
          content: 'Learning TypeScript is fun',
          senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
        {
          _id: 'post2',
          content: 'I love cooking pasta',
          senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
        {
          _id: 'post3',
          content: 'JavaScript frameworks comparison',
          senderId: { _id: mockUserId, username: 'user1', email: 'user1@test.com' },
        },
      ];

      setupPostsMock(mockPosts);

      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '["post1", "post3"]' } }],
      });

      const response = await request(app)
        .get('/ai/search?q=programming')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(2);
      expect(response.body.posts[0]._id).toBe('post1');
      expect(response.body.posts[1]._id).toBe('post3');
      expect(response.body.query).toBe('programming');
    });

    it('should return 400 for empty query', async () => {
      const response = await request(app)
        .get('/ai/search?q=')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(400);

      expect(response.body.error).toBe('Search query is required');
    });

    it('should return 400 for missing query parameter', async () => {
      const response = await request(app)
        .get('/ai/search')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(400);

      expect(response.body.error).toBe('Search query is required');
    });

    it('should return 401 without authentication', async () => {
      await request(app)
        .get('/ai/search?q=test')
        .expect(401);
    });

    it('should return 401 with invalid token', async () => {
      (MockedJwt.verify as jest.Mock) = jest.fn().mockImplementation(() => {
        throw new jwt.JsonWebTokenError('Invalid token');
      });

      const response = await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', 'Bearer invalid-token')
        .expect(401);

      expect(response.body.error).toBe('Invalid token');
    });

    it('should return 500 when OPENAI_API_KEY is not configured', async () => {
      delete process.env.OPENAI_API_KEY;

      const response = await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(500);

      expect(response.body.error).toBe('AI search is not configured');
    });

    it('should return empty posts array when no matches found', async () => {
      const mockPosts = [
        { _id: 'post1', content: 'Random content', senderId: { _id: mockUserId } },
      ];

      setupPostsMock(mockPosts);
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '[]' } }],
      });

      const response = await request(app)
        .get('/ai/search?q=nonexistent')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(0);
    });

    it('should handle OpenAI API errors gracefully', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      setupPostsMock([{ _id: 'post1', content: 'Test', senderId: { _id: mockUserId } }]);
      mockCreate.mockRejectedValue(new Error('API Error'));

      const response = await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(500);

      expect(response.body.error).toBe('AI search failed');
      consoleSpy.mockRestore();
    });

    it('should return 500 with specific message for invalid API key', async () => {
      const consoleSpy = jest.spyOn(console, 'error').mockImplementation();
      setupPostsMock([{ _id: 'post1', content: 'Test', senderId: { _id: mockUserId } }]);
      const apiKeyError = new Error('Invalid API key') as any;
      apiKeyError.status = 401;
      apiKeyError.code = 'invalid_api_key';
      mockCreate.mockRejectedValue(apiKeyError);

      const response = await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(500);

      expect(response.body.error).toBe('AI service authentication failed');
      consoleSpy.mockRestore();
    });

    it('should return posts in relevance order', async () => {
      const mockPosts = [
        { _id: 'post1', content: 'First post', senderId: { _id: mockUserId } },
        { _id: 'post2', content: 'Second post', senderId: { _id: mockUserId } },
        { _id: 'post3', content: 'Third post', senderId: { _id: mockUserId } },
      ];

      setupPostsMock(mockPosts);
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '["post3", "post1"]' } }],
      });

      const response = await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.posts[0]._id).toBe('post3');
      expect(response.body.posts[1]._id).toBe('post1');
    });

    it('should handle empty database gracefully', async () => {
      setupPostsMock([]);

      const response = await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', `Bearer ${mockAccessToken}`)
        .expect(200);

      expect(response.body.posts).toHaveLength(0);
      expect(mockCreate).not.toHaveBeenCalled();
    });
  });
});

describe('AI Controller Helper Functions', () => {
  describe('checkRateLimit', () => {
    beforeEach(() => {
      jest.useFakeTimers();
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    it('should allow first request for a user', () => {
      const result = checkRateLimit('user-new-1');
      expect(result).toBe(true);
    });

    it('should allow multiple requests under the limit', () => {
      const userId = 'user-under-limit';
      for (let i = 0; i < 9; i++) {
        expect(checkRateLimit(userId)).toBe(true);
      }
    });

    it('should block requests after exceeding the limit', () => {
      const userId = 'user-over-limit';
      for (let i = 0; i < 10; i++) {
        checkRateLimit(userId);
      }
      expect(checkRateLimit(userId)).toBe(false);
    });

    it('should reset limit after the time window', () => {
      const userId = 'user-reset-test';
      for (let i = 0; i < 10; i++) {
        checkRateLimit(userId);
      }
      expect(checkRateLimit(userId)).toBe(false);

      jest.advanceTimersByTime(60 * 1000 + 1);
      expect(checkRateLimit(userId)).toBe(true);
    });

    it('should track different users separately', () => {
      const userId1 = 'user-separate-1';
      const userId2 = 'user-separate-2';

      for (let i = 0; i < 10; i++) {
        checkRateLimit(userId1);
      }

      expect(checkRateLimit(userId1)).toBe(false);
      expect(checkRateLimit(userId2)).toBe(true);
    });
  });

  describe('buildSearchPrompt', () => {
    it('should build prompt with query and posts', () => {
      const query = 'programming tips';
      const posts = [
        { id: 'post1', content: 'Learn TypeScript' },
        { id: 'post2', content: 'Cooking recipes' },
      ];

      const prompt = buildSearchPrompt(query, posts);

      expect(prompt).toContain('programming tips');
      expect(prompt).toContain('ID: post1');
      expect(prompt).toContain('Content: Learn TypeScript');
      expect(prompt).toContain('ID: post2');
      expect(prompt).toContain('Content: Cooking recipes');
    });

    it('should handle empty posts array', () => {
      const prompt = buildSearchPrompt('test', []);
      expect(prompt).toContain('test');
    });
  });

  describe('parseRelevantPostIds', () => {
    it('should parse valid JSON array of IDs', () => {
      const result = parseRelevantPostIds('["id1", "id2", "id3"]');
      expect(result).toEqual(['id1', 'id2', 'id3']);
    });

    it('should handle JSON wrapped in code blocks', () => {
      const result = parseRelevantPostIds('```json\n["id1", "id2"]\n```');
      expect(result).toEqual(['id1', 'id2']);
    });

    it('should return empty array for invalid JSON', () => {
      const result = parseRelevantPostIds('not valid json');
      expect(result).toEqual([]);
    });

    it('should return empty array for non-array JSON', () => {
      const result = parseRelevantPostIds('{"id": "test"}');
      expect(result).toEqual([]);
    });

    it('should filter out non-string values from array', () => {
      const result = parseRelevantPostIds('["id1", 123, null, "id2"]');
      expect(result).toEqual(['id1', 'id2']);
    });

    it('should return empty array for empty string', () => {
      const result = parseRelevantPostIds('');
      expect(result).toEqual([]);
    });

    it('should handle empty JSON array', () => {
      const result = parseRelevantPostIds('[]');
      expect(result).toEqual([]);
    });
  });
});

describe('Rate Limit Integration', () => {
  const mockUserId = '507f1f77bcf86cd799439011';
  const mockAccessToken = 'mock-access-token';
  const originalEnv = process.env;

  const mockUser = {
    _id: mockUserId,
    username: 'testuser',
    email: 'test@example.com',
  };

  beforeEach(() => {
    jest.clearAllMocks();
    process.env = { ...originalEnv, OPENAI_API_KEY: 'test-api-key' };

    (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue({ userId: 'rate-limit-user' });
    (MockedUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ ...mockUser, _id: 'rate-limit-user' }),
    });

    mockCreate.mockResolvedValue({
      choices: [{ message: { content: '[]' } }],
    });

    (MockedPost.find as jest.Mock) = jest.fn().mockReturnValue({
      populate: jest.fn().mockReturnValue({
        sort: jest.fn().mockReturnValue({
          limit: jest.fn().mockReturnValue({
            lean: jest.fn().mockResolvedValue([]),
          }),
        }),
      }),
    });
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('should return 429 when rate limit is exceeded', async () => {
    const uniqueUserId = `rate-limit-user-${Date.now()}`;
    (MockedJwt.verify as jest.Mock) = jest.fn().mockReturnValue({ userId: uniqueUserId });
    (MockedUser.findById as jest.Mock) = jest.fn().mockReturnValue({
      select: jest.fn().mockResolvedValue({ ...mockUser, _id: uniqueUserId }),
    });

    for (let i = 0; i < 10; i++) {
      await request(app)
        .get('/ai/search?q=test')
        .set('Authorization', `Bearer ${mockAccessToken}`);
    }

    const response = await request(app)
      .get('/ai/search?q=test')
      .set('Authorization', `Bearer ${mockAccessToken}`)
      .expect(429);

    expect(response.body.error).toBe('Rate limit exceeded. Try again in a minute.');
  });
});
