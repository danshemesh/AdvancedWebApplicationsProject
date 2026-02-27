import express from 'express';
import {
  createPost,
  getAllPosts,
  getPostById,
  updatePost,
  deletePost,
  addLike,
  removeLike,
} from '../controllers/post';
import { authenticateToken } from '../middleware/auth';
import { uploadPostImage } from '../middleware/upload';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Post:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Post ID
 *         content:
 *           type: string
 *           description: Post content
 *         senderId:
 *           type: string
 *           description: ID of the user who created the post
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 *         imagePath:
 *           type: string
 *           description: Relative path to post image (e.g. posts/userId-timestamp.jpg)
 *           nullable: true
 *         likeCount:
 *           type: integer
 *           description: Number of likes (in list/detail responses)
 *         likedByCurrentUser:
 *           type: boolean
 *           description: Whether the current user liked this post (in list/detail responses)
 */

/**
 * @swagger
 * /post:
 *   post:
 *     summary: Create a new post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *                 description: Post content (required)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional image file (JPEG, PNG, WebP, max 2MB)
 *     responses:
 *       201:
 *         description: Post created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       400:
 *         description: Validation error
 *       401:
 *         description: Unauthorized - token required
 */
router.post('/', authenticateToken, uploadPostImage, createPost);

/**
 * @swagger
 * /post:
 *   get:
 *     summary: Get all posts (paginated)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: sender
 *         schema:
 *           type: string
 *         description: Filter posts by sender ID
 *       - in: query
 *         name: page
 *         schema:
 *           type: integer
 *           default: 1
 *           minimum: 1
 *         description: Page number
 *       - in: query
 *         name: limit
 *         schema:
 *           type: integer
 *           default: 10
 *           minimum: 1
 *           maximum: 100
 *         description: Number of posts per page
 *     responses:
 *       200:
 *         description: Paginated list of posts with comment counts
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 posts:
 *                   type: array
 *                   items:
 *                     allOf:
 *                       - $ref: '#/components/schemas/Post'
 *                       - type: object
 *                         properties:
 *                           commentCount:
 *                             type: integer
 *                             description: Number of comments on the post
 *                 total:
 *                   type: integer
 *                   description: Total number of posts
 *                 page:
 *                   type: integer
 *                   description: Current page number
 *                 totalPages:
 *                   type: integer
 *                   description: Total number of pages
 *                 hasMore:
 *                   type: boolean
 *                   description: Whether more pages exist
 *       401:
 *         description: Unauthorized - token required
 */
router.get('/', authenticateToken, getAllPosts);

/**
 * @swagger
 * /post/{id}/like:
 *   post:
 *     summary: Like a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       201:
 *         description: Post liked
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 liked:
 *                   type: boolean
 *                   example: true
 *       200:
 *         description: Already liked (idempotent)
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized
 */
router.post('/:id/like', authenticateToken, addLike);

/**
 * @swagger
 * /post/{id}/like:
 *   delete:
 *     summary: Remove like from a post
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Like removed
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 liked:
 *                   type: boolean
 *                   example: false
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized
 */
router.delete('/:id/like', authenticateToken, removeLike);

/**
 * @swagger
 * /post/{id}:
 *   get:
 *     summary: Get post by ID
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *       400:
 *         description: Invalid post ID
 *       401:
 *         description: Unauthorized - token required
 */
router.get('/:id', authenticateToken, getPostById);

/**
 * @swagger
 * /post/{id}:
 *   put:
 *     summary: Update post (only by owner)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     requestBody:
 *       content:
 *         multipart/form-data:
 *           schema:
 *             type: object
 *             properties:
 *               content:
 *                 type: string
 *                 description: Updated post content (optional)
 *               image:
 *                 type: string
 *                 format: binary
 *                 description: Optional new image (replaces existing)
 *     responses:
 *       200:
 *         description: Post updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Post'
 *       404:
 *         description: Post not found
 *       403:
 *         description: Forbidden - can only update own posts
 *       400:
 *         description: Validation error or invalid post ID
 *       401:
 *         description: Unauthorized - token required
 */
router.put('/:id', authenticateToken, uploadPostImage, updatePost);

/**
 * @swagger
 * /post/{id}:
 *   delete:
 *     summary: Delete post (only by owner)
 *     tags: [Posts]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID
 *     responses:
 *       200:
 *         description: Post deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Post deleted successfully
 *       404:
 *         description: Post not found
 *       403:
 *         description: Forbidden - can only delete own posts
 *       400:
 *         description: Invalid post ID
 *       401:
 *         description: Unauthorized - token required
 */
router.delete('/:id', authenticateToken, deletePost);

export default router;

