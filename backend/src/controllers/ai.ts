import { Response } from 'express';
import OpenAI from 'openai';
import Post from '../models/post';
import { AuthRequest } from '../middleware/auth';

let openaiClient: OpenAI | null = null;

function getOpenAIClient(): OpenAI {
  if (!openaiClient) {
    openaiClient = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
  }
  return openaiClient;
}

const rateLimits = new Map<string, { count: number; resetAt: number }>();
const RATE_LIMIT = 10;
const RATE_WINDOW_MS = 60 * 1000;

function checkRateLimit(userId: string): boolean {
  const now = Date.now();
  const record = rateLimits.get(userId);

  if (!record || now >= record.resetAt) {
    rateLimits.set(userId, { count: 1, resetAt: now + RATE_WINDOW_MS });
    return true;
  }

  if (record.count >= RATE_LIMIT) {
    return false;
  }

  record.count++;
  return true;
}

function buildSearchPrompt(query: string, posts: { id: string; content: string }[]): string {
  const postsText = posts.map(p => `ID: ${p.id}\nContent: ${p.content}`).join('\n\n');
  return `Given this search query: "${query}"

Find posts that are semantically relevant to the query. Return ONLY a JSON array of post IDs that match, ordered by relevance (most relevant first). If no posts match, return an empty array.

Posts:
${postsText}

Response (JSON array of IDs only):`;
}

function parseRelevantPostIds(response: string): string[] {
  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed.filter(id => typeof id === 'string');
    }
    return [];
  } catch {
    return [];
  }
}

export async function searchPostsByAI(query: string, allPosts: { id: string; content: string }[]): Promise<string[]> {
  if (allPosts.length === 0) return [];

  const prompt = buildSearchPrompt(query, allPosts);

  const completion = await getOpenAIClient().chat.completions.create({
    model: 'gpt-3.5-turbo',
    messages: [{ role: 'user', content: prompt }],
    temperature: 0,
    max_tokens: 500,
  });

  const responseText = completion.choices[0]?.message?.content || '[]';
  return parseRelevantPostIds(responseText);
}

export const searchPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    if (!process.env.OPENAI_API_KEY) {
      res.status(500).json({ error: 'AI search is not configured' });
      return;
    }

    if (!checkRateLimit(req.user!.id)) {
      res.status(429).json({ error: 'Rate limit exceeded. Try again in a minute.' });
      return;
    }

    const posts = await Post.find()
      .populate('senderId', 'username email profilePicturePath')
      .sort({ createdAt: -1 })
      .limit(100)
      .lean();

    const postsForSearch = posts.map(p => ({
      id: p._id.toString(),
      content: p.content,
    }));

    const relevantIds = await searchPostsByAI(query, postsForSearch);

    const idOrder = new Map(relevantIds.map((id, index) => [id, index]));
    const matchedPosts = posts
      .filter(p => relevantIds.includes(p._id.toString()))
      .sort((a, b) => (idOrder.get(a._id.toString()) ?? 999) - (idOrder.get(b._id.toString()) ?? 999));

    res.status(200).json({ posts: matchedPosts, query });
  } catch (error: any) {
    console.error('AI search error:', error);
    if (error?.status === 401 || error?.code === 'invalid_api_key') {
      res.status(500).json({ error: 'AI service authentication failed' });
      return;
    }
    res.status(500).json({ error: 'AI search failed' });
  }
};

export { checkRateLimit, buildSearchPrompt, parseRelevantPostIds };
