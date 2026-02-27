import express from 'express';
import { searchPosts } from '../controllers/ai';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * /ai/search:
 *   get:
 *     summary: Search posts using AI-powered semantic search
 *     description: Uses OpenAI to find posts that semantically match the search query. Rate limited to 10 requests per minute per user.
 *     tags: [AI]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: q
 *         required: true
 *         schema:
 *           type: string
 *         description: The search query (free-text)
 *         example: "posts about programming"
 *     responses:
 *       200:
 *         description: Search results
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     $ref: '#/components/schemas/Post'
 *                 query:
 *                   type: string
 *                   description: The original search query
 *       400:
 *         description: Missing or empty search query
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Search query is required"
 *       401:
 *         description: Unauthorized - token required
 *       429:
 *         description: Rate limit exceeded
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 error:
 *                   type: string
 *                   example: "Rate limit exceeded. Try again in a minute."
 *       500:
 *         description: Server error or AI service failure
 */
router.get('/search', authenticateToken, searchPosts);

export default router;
