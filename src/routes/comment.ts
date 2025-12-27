import express from 'express';
import {
  createComment,
  getCommentById,
  getCommentsByPost,
  updateComment,
  deleteComment,
} from '../controllers/comment';
import { authenticateToken } from '../middleware/auth';

const router = express.Router();

/**
 * @swagger
 * components:
 *   schemas:
 *     Comment:
 *       type: object
 *       properties:
 *         _id:
 *           type: string
 *           description: Comment ID
 *         postId:
 *           type: string
 *           description: ID of the post this comment belongs to
 *         content:
 *           type: string
 *           description: Comment content
 *         authorId:
 *           type: string
 *           description: ID of the user who created the comment
 *         createdAt:
 *           type: string
 *           format: date-time
 *         updatedAt:
 *           type: string
 *           format: date-time
 */

/**
 * @swagger
 * /comment:
 *   post:
 *     summary: Create a new comment
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - postId
 *               - content
 *             properties:
 *               postId:
 *                 type: string
 *                 description: ID of the post to comment on
 *               content:
 *                 type: string
 *                 description: Comment content
 *           example:
 *             postId: "507f1f77bcf86cd799439011"
 *             content: "Great post!"
 *     responses:
 *       201:
 *         description: Comment created successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Validation error
 *       404:
 *         description: Post not found
 *       401:
 *         description: Unauthorized - token required
 */
router.post('/', authenticateToken, createComment);

/**
 * @swagger
 * /comment:
 *   get:
 *     summary: Get comments by post ID
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: post
 *         required: true
 *         schema:
 *           type: string
 *         description: Post ID to get comments for
 *     responses:
 *       200:
 *         description: List of comments for the post
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items:
 *                 $ref: '#/components/schemas/Comment'
 *       400:
 *         description: Post ID query parameter is required
 *       401:
 *         description: Unauthorized - token required
 */
router.get('/', authenticateToken, getCommentsByPost);

/**
 * @swagger
 * /comment/{id}:
 *   get:
 *     summary: Get comment by ID
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment details
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
 *       400:
 *         description: Invalid comment ID
 *       401:
 *         description: Unauthorized - token required
 */
router.get('/:id', authenticateToken, getCommentById);

/**
 * @swagger
 * /comment/{id}:
 *   put:
 *     summary: Update comment (only by author)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - content
 *             properties:
 *               content:
 *                 type: string
 *           example:
 *             content: "Updated comment content"
 *     responses:
 *       200:
 *         description: Comment updated successfully
 *         content:
 *           application/json:
 *             schema:
 *               $ref: '#/components/schemas/Comment'
 *       404:
 *         description: Comment not found
 *       403:
 *         description: Forbidden - can only update own comments
 *       400:
 *         description: Validation error or invalid comment ID
 *       401:
 *         description: Unauthorized - token required
 */
router.put('/:id', authenticateToken, updateComment);

/**
 * @swagger
 * /comment/{id}:
 *   delete:
 *     summary: Delete comment (only by author)
 *     tags: [Comments]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *         description: Comment ID
 *     responses:
 *       200:
 *         description: Comment deleted successfully
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 message:
 *                   type: string
 *                   example: Comment deleted successfully
 *       404:
 *         description: Comment not found
 *       403:
 *         description: Forbidden - can only delete own comments
 *       400:
 *         description: Invalid comment ID
 *       401:
 *         description: Unauthorized - token required
 */
router.delete('/:id', authenticateToken, deleteComment);

export default router;

