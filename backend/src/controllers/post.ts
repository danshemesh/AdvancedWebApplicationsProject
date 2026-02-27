import { Response } from 'express';
import { Types } from 'mongoose';
import Post from '../models/post';
import Comment from '../models/comment';
import { AuthRequest } from '../middleware/auth';

export const getCommentCountsForPosts = async (postIds: Types.ObjectId[]): Promise<Map<string, number>> => {
  const commentCounts = await Comment.aggregate([
    { $match: { postId: { $in: postIds } } },
    { $group: { _id: '$postId', count: { $sum: 1 } } },
  ]);
  
  return new Map(commentCounts.map(item => [item._id.toString(), item.count]));
};

export const addCommentCountsToPosts = <T extends { _id: Types.ObjectId }>(
  posts: T[],
  commentCountMap: Map<string, number>
): (T & { commentCount: number })[] => {
  return posts.map(post => ({
    ...post,
    commentCount: commentCountMap.get(post._id.toString()) || 0,
  }));
};

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
    const page = Math.max(1, parseInt(req.query.page as string) || 1);
    const limit = Math.max(1, Math.min(100, parseInt(req.query.limit as string) || 10));
    const skip = (page - 1) * limit;
    
    const filter = req.query.sender ? { senderId: req.query.sender } : {};
    
    const [posts, total] = await Promise.all([
      Post.find(filter)
        .populate('senderId', 'username email')
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit),
      Post.countDocuments(filter),
    ]);
    
    const postIds = posts.map(post => post._id);
    const commentCountMap = await getCommentCountsForPosts(postIds);
    const postsWithCommentCount = addCommentCountsToPosts(
      posts.map(post => post.toObject()),
      commentCountMap
    );
    
    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;
    
    res.status(200).json({
      posts: postsWithCommentCount,
      total,
      page,
      totalPages,
      hasMore,
    });
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

