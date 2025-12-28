import { Response } from 'express';
import Comment from '../models/comment';
import Post from '../models/post';
import { AuthRequest } from '../middleware/auth';

export const createComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { postId, content } = req.body;

    if (!postId) {
      res.status(400).json({ error: 'Post ID is required' });
      return;
    }

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const post = await Post.findById(postId);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    const comment = new Comment({
      postId,
      content,
      authorId: req.user!.id,
    });

    await comment.save();
    res.status(201).json(comment);
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to create comment' });
  }
};

export const getCommentById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comment = await Comment.findById(req.params.id)
      .populate('authorId', 'username email')
      .populate('postId', 'content');

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    res.status(200).json(comment);
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch comment' });
  }
};

export const getCommentsByPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const postId = req.query.post as string;

    if (!postId) {
      res.status(400).json({ error: 'Post ID query parameter is required' });
      return;
    }

    const comments = await Comment.find({ postId })
      .populate('authorId', 'username email');

    res.status(200).json(comments);
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch comments' });
  }
};

export const updateComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.authorId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'You can only update your own comments' });
      return;
    }

    comment.content = content;
    await comment.save();

    res.status(200).json(comment);
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    res.status(500).json({ error: 'Failed to update comment' });
  }
};

export const deleteComment = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const comment = await Comment.findById(req.params.id);

    if (!comment) {
      res.status(404).json({ error: 'Comment not found' });
      return;
    }

    if (comment.authorId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'You can only delete your own comments' });
      return;
    }

    await Comment.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Comment deleted successfully' });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid comment ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete comment' });
  }
};

