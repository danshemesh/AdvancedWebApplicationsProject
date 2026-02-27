/// <reference path="./types/express.d.ts" />
import path from 'path';
import dotenv from 'dotenv';

// Must be called before any import that reads process.env (e.g. passport config)
dotenv.config({ path: path.resolve(__dirname, '..', '.env') });

import cors from 'cors';
import express, { Request, Response, NextFunction } from 'express';
import mongoose from 'mongoose';
import swaggerUi from 'swagger-ui-express';
import swaggerJsdoc from 'swagger-jsdoc';
import { swaggerOptions } from './config/swagger';
import './config/passport';
import userRoutes from './routes/user';
import authRoutes from './routes/auth';
import postRoutes from './routes/post';
import commentRoutes from './routes/comment';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors({ origin: process.env.CORS_ORIGIN || 'http://localhost:5173', credentials: true }));
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, '..', 'uploads')));

const swaggerSpec = swaggerJsdoc(swaggerOptions);
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec));
app.use('/user', userRoutes);
app.use('/auth', authRoutes);
app.use('/post', postRoutes);
app.use('/comment', commentRoutes);

if (process.env.NODE_ENV !== 'test') {
  const MONGO_URI = process.env.MONGODB_URI || '';

  if (!MONGO_URI) {
    console.error('MONGODB_URI is not defined in environment variables');
    process.exit(1);
  }

  mongoose.connect(MONGO_URI)
    .then(() => console.log('Connected to MongoDB'))
    .catch((err) => console.error('MongoDB connection error:', err));

  app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
  });
}

app.use((err: Error & { code?: string }, req: Request, res: Response, next: NextFunction) => {
  console.error(err.stack);
  if (err.code === 'LIMIT_FILE_SIZE' || err.message?.includes('images are allowed')) {
    res.status(400).json({ error: err.message || 'Invalid file' });
    return;
  }
  res.status(500).json({
    error: 'Internal server error',
    message: process.env.NODE_ENV === 'development' ? err.message : undefined,
  });
});

app.use((req: Request, res: Response) => {
  res.status(404).json({ error: 'Route not found' });
});

export default app;
