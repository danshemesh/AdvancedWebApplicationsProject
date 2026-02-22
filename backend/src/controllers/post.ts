import path from 'path';
import fs from 'fs';
import { Response } from 'express';
import { Types } from 'mongoose';
import Post from '../models/post';
import Comment from '../models/comment';
import Like from '../models/like';
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

export const getLikeCountsForPosts = async (postIds: Types.ObjectId[]): Promise<Map<string, number>> => {
  if (postIds.length === 0) return new Map();
  const likeCounts = await Like.aggregate([
    { $match: { postId: { $in: postIds } } },
    { $group: { _id: '$postId', count: { $sum: 1 } } },
  ]);
  return new Map(likeCounts.map(item => [item._id.toString(), item.count]));
};

export const getLikedByUserForPosts = async (
  postIds: Types.ObjectId[],
  userId: string
): Promise<Set<string>> => {
  if (postIds.length === 0 || !userId) return new Set();
  const liked = await Like.find({ postId: { $in: postIds }, userId }).select('postId').lean();
  return new Set(liked.map(l => l.postId.toString()));
};

export const createPost = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const content = req.body?.content;

    if (!content) {
      res.status(400).json({ error: 'Content is required' });
      return;
    }

    const imagePath = req.file
      ? path.join('posts', req.file.filename).split(path.sep).join('/')
      : undefined;

    const post = new Post({
      content,
      senderId: req.user!.id,
      ...(imagePath && { imagePath }),
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
    const [commentCountMap, likeCountMap, likedSet] = await Promise.all([
      getCommentCountsForPosts(postIds),
      getLikeCountsForPosts(postIds),
      getLikedByUserForPosts(postIds, req.user!.id),
    ]);
    const postsWithCommentCount = addCommentCountsToPosts(
      posts.map(post => post.toObject()),
      commentCountMap
    );
    const postsWithCounts = postsWithCommentCount.map(post => ({
      ...post,
      likeCount: likeCountMap.get(post._id.toString()) || 0,
      likedByCurrentUser: likedSet.has(post._id.toString()),
    }));

    const totalPages = Math.ceil(total / limit);
    const hasMore = page < totalPages;

    res.status(200).json({
      posts: postsWithCounts,
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

    const postId = post._id;
    const [likeCount, userLike] = await Promise.all([
      Like.countDocuments({ postId }),
      Like.findOne({ postId, userId: req.user!.id }).lean(),
    ]);

    const postObj = post.toObject();
    res.status(200).json({
      ...postObj,
      likeCount,
      likedByCurrentUser: !!userLike,
    });
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
    const content = req.body?.content;

    const post = await Post.findById(req.params.id);

    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }

    if (post.senderId.toString() !== req.user!.id) {
      res.status(403).json({ error: 'You can only update your own posts' });
      return;
    }

    if (content === undefined && !req.file) {
      res.status(400).json({ error: 'Provide content and/or image to update' });
      return;
    }

    if (content !== undefined) post.content = content;

    if (req.file) {
      if (post.imagePath) {
        const oldPath = path.join(process.cwd(), 'uploads', post.imagePath);
        try {
          await fs.promises.unlink(oldPath);
        } catch {
          // ignore if file missing
        }
      }
      post.imagePath = path.join('posts', req.file.filename).split(path.sep).join('/');
    }

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

    if (post.imagePath) {
      const filePath = path.join(process.cwd(), 'uploads', post.imagePath);
      try {
        await fs.promises.unlink(filePath);
      } catch {
        // ignore if file missing
      }
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

export const addLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    const like = new Like({ postId: post._id, userId: req.user!.id });
    try {
      await like.save();
      res.status(201).json({ liked: true });
    } catch (err: any) {
      if (err.code === 11000) {
        res.status(200).json({ liked: true });
        return;
      }
      throw err;
    }
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to add like' });
  }
};

export const removeLike = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const post = await Post.findById(req.params.id);
    if (!post) {
      res.status(404).json({ error: 'Post not found' });
      return;
    }
    await Like.deleteOne({ postId: req.params.id, userId: req.user!.id });
    res.status(200).json({ liked: false });
  } catch (error: any) {
    if (error.name === 'CastError') {
      res.status(400).json({ error: 'Invalid post ID' });
      return;
    }
    res.status(500).json({ error: 'Failed to remove like' });
  }
};

