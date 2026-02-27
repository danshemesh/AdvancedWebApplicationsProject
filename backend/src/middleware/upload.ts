import path from 'path';
import fs from 'fs';
import multer from 'multer';
import { AuthRequest } from './auth';

const AVATARS_DIR = path.join(process.cwd(), 'uploads', 'avatars');
const POSTS_DIR = path.join(process.cwd(), 'uploads', 'posts');
const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
const ALLOWED_MIMES = ['image/jpeg', 'image/png', 'image/webp'];

try {
  fs.mkdirSync(AVATARS_DIR, { recursive: true });
  fs.mkdirSync(POSTS_DIR, { recursive: true });
} catch {
  // Directory may already exist
}

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, AVATARS_DIR);
  },
  filename: (req, file, cb) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id ?? 'anonymous';
    const ext = path.extname(file.originalname) || '.jpg';
    const name = `${userId}-${Date.now()}${ext}`;
    cb(null, name);
  },
});

const fileFilter = (
  _req: Express.Request,
  file: Express.Multer.File,
  cb: multer.FileFilterCallback
) => {
  if (ALLOWED_MIMES.includes(file.mimetype)) {
    cb(null, true);
  } else {
    cb(new Error('Only JPEG, PNG and WebP images are allowed'));
  }
};

export const uploadAvatar = multer({
  storage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('avatar');

const postImageStorage = multer.diskStorage({
  destination: (_req, _file, cb) => {
    cb(null, POSTS_DIR);
  },
  filename: (req, file, cb) => {
    const authReq = req as AuthRequest;
    const userId = authReq.user?.id ?? 'anonymous';
    const ext = path.extname(file.originalname) || '.jpg';
    cb(null, `${userId}-${Date.now()}${ext}`);
  },
});

export const uploadPostImage = multer({
  storage: postImageStorage,
  limits: { fileSize: MAX_FILE_SIZE },
  fileFilter,
}).single('image');
