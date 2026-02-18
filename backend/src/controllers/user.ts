import path from 'path';
import fs from 'fs';
import { Request, Response } from 'express';
import User from '../models/user';
import bcrypt from 'bcryptjs';
import { AuthRequest } from '../middleware/auth';

const isValidObjectId = (id: string): boolean => {
  return /^[0-9a-fA-F]{24}$/.test(id);
};

const sanitizeUser = (user: any): any => {
  const userResponse: any = user.toObject();
  delete userResponse.password;
  delete userResponse.refreshToken;
  return userResponse;
};

export const getAllUsers = async (req: Request, res: Response): Promise<void> => {
  try {
    const users = await User.find().select('-password -refreshToken');
    res.status(200).json(users);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch users' });
  }
};

export const getUserById = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    
    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID format' });
      return;
    }

    const user = await User.findById(id).select('-password -refreshToken');
    
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json(user);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch user' });
  }
};

export const createUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { username, email, password } = req.body;

    if (!username || !email || !password) {
      res.status(400).json({ error: 'Username, email, and password are required' });
      return;
    }

    const existingUser = await User.findOne({
      $or: [{ email }, { username }],
    });

    if (existingUser) {
      res.status(400).json({ error: 'User with this email or username already exists' });
      return;
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    res.status(201).json(sanitizeUser(user));
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    res.status(500).json({ error: 'Failed to create user' });
  }
};

export const updateUser = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;
    const { username, email, password } = req.body;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID format' });
      return;
    }

    const user = await User.findById(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    const isSelfUpdate = req.user && req.params.id === req.user.id;
    if (isSelfUpdate) {
      if (username !== undefined) user.username = username;
    } else {
      if (username) user.username = username;
      if (email) user.email = email;
      if (password) {
        user.password = await bcrypt.hash(password, 10);
      }
    }

    await user.save();
    res.status(200).json(sanitizeUser(user));
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    if (error.code === 11000) {
      res.status(400).json({ error: 'Username or email already exists' });
      return;
    }
    res.status(500).json({ error: 'Failed to update user' });
  }
};

export const uploadAvatar = async (req: AuthRequest, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (id !== req.user!.id) {
      res.status(403).json({ error: 'You can only update your own avatar' });
      return;
    }

    if (!req.file) {
      res.status(400).json({ error: 'Avatar image is required' });
      return;
    }

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID format' });
      return;
    }

    const user = await User.findById(id);
    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    if (user.profilePicturePath) {
      const oldPath = path.join(process.cwd(), 'uploads', user.profilePicturePath);
      try {
        await fs.promises.unlink(oldPath);
      } catch {
        // Ignore if file already missing
      }
    }

    const relativePath = path.join('avatars', req.file.filename).split(path.sep).join('/');
    user.profilePicturePath = relativePath;
    await user.save();

    res.status(200).json(sanitizeUser(user));
  } catch (error: any) {
    if (error.name === 'ValidationError') {
      const errors = Object.values(error.errors).map((err: any) => err.message);
      res.status(400).json({ error: errors.join(', ') });
      return;
    }
    res.status(500).json({ error: 'Failed to upload avatar' });
  }
};

export const deleteUser = async (req: Request, res: Response): Promise<void> => {
  try {
    const { id } = req.params;

    if (!isValidObjectId(id)) {
      res.status(400).json({ error: 'Invalid user ID format' });
      return;
    }

    const user = await User.findByIdAndDelete(id);

    if (!user) {
      res.status(404).json({ error: 'User not found' });
      return;
    }

    res.status(200).json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to delete user' });
  }
};
