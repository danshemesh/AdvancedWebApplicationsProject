import { Response } from 'express';
import Post from '../models/post';
import { AuthRequest } from '../middleware/auth';

export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const post = new Post({
      content,
      senderId: req.user!.id,
    });

    await post.save();
    res.status(201).json(post);
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    res.status(500).json({ error: 'Failed to create post' });
  }
};

export const getAllPosts = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const filter = req.query.sender ? { senderId: req.query.sender } : {};
    const posts = await Post.find(filter).populate('senderId', 'username email');
    res.status(200).json(posts);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch posts' });
  }
};

export const getPostById = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const post = await Post.findById(req.params.id).populate('senderId', 'username email');

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    res.status(200).json(post);
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to fetch post' });
  }
};

export const updatePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { content } = req.body;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.senderId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'You can only update your own posts' });
      return;
    }

    post.content = content;
    await post.save();

    res.status(200).json(post);
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    res.status(500).json({ error: 'Failed to update post' });
  }
};

export const deletePost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.senderId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'You can only delete your own posts' });
      return;
    }

    await Post.findByIdAndDelete(req.params.id);

    res.status(200).json({ message: 'Post deleted successfully' });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to delete post' });
  }
};

