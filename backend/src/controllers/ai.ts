import { Response } from 'express';
import { GoogleGenAI } from '@google/genai';
import Post from '../models/post';
import { AuthRequest } from '../middleware/auth';

let geminiClient: GoogleGenAI | null = null;

function getGeminiClient(): GoogleGenAI {
  if (!geminiClient) {
    geminiClient = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }
  return geminiClient;
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

interface SearchResult {
  id: string;
  reason: string;
}

function buildSearchPrompt(query: string, posts: { id: string; content: string }[]): string {
  const postsText = posts.map(p => `ID: ${p.id}\nContent: ${p.content}`).join('\n\n');
  return `Given this search query: "${query}"

Find posts that are semantically relevant to the query. Return a JSON array of objects with "id" and "reason" fields, ordered by relevance (most relevant first). The reason should be a brief explanation (max 10 words) of why this post matches. If no posts match, return an empty array.

Example response format: [{"id": "abc123", "reason": "Discusses the topic directly"}]

Posts:
${postsText}

Response (JSON array only):`;
}

function parseSearchResults(response: string): SearchResult[] {
  try {
    const cleaned = response.replace(/```json\n?|\n?```/g, '').trim();
    const parsed = JSON.parse(cleaned);
    if (Array.isArray(parsed)) {
      return parsed
        .filter(item => item && typeof item.id === 'string')
        .map(item => ({
          id: item.id,
          reason: typeof item.reason === 'string' ? item.reason : 'Relevant to search'
        }));
    }
    return [];
  } catch {
    return [];
  }
}

export async function searchPostsByAI(query: string, allPosts: { id: string; content: string }[]): Promise<SearchResult[]> {
  if (allPosts.length === 0) return [];

  const prompt = buildSearchPrompt(query, allPosts);

  const response = await getGeminiClient().models.generateContent({
    model: 'gemini-2.5-flash',
    contents: prompt,
  });

  const responseText = response.text || '[]';
  return parseSearchResults(responseText);
}

export const searchPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const query = req.query.q as string;

    if (!query || query.trim().length === 0) {
      res.status(400).json({ error: 'Search query is required' });
      return;
    }

    if (!process.env.GEMINI_API_KEY) {
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

    const searchResults = await searchPostsByAI(query, postsForSearch);

    const resultMap = new Map(searchResults.map((r, index) => [r.id, { index, reason: r.reason }]));
    const matchedPosts = posts
      .filter(p => resultMap.has(p._id.toString()))
      .sort((a, b) => (resultMap.get(a._id.toString())?.index ?? 999) - (resultMap.get(b._id.toString())?.index ?? 999))
      .map(p => ({
        ...p,
        searchReason: resultMap.get(p._id.toString())?.reason || 'Relevant to search'
      }));

    res.status(200).json({ posts: matchedPosts, query });
  } catch (error: any) {
    console.error('AI search error:', error);
    if (error?.status === 401 || error?.message?.includes('API key')) {
      res.status(500).json({ error: 'AI service authentication failed' });
      return;
    }
    if (error?.status === 429) {
      res.status(500).json({ error: 'AI service rate limit exceeded' });
      return;
    }
    res.status(500).json({ error: 'AI search failed' });
  }
};

export { checkRateLimit, buildSearchPrompt, parseSearchResults };
