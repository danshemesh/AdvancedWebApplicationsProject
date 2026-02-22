import mongoose, { Document, Schema, Types } from 'mongoose';

export interface IPost extends Document {
  content: string;
  senderId: Types.ObjectId;
  createdAt: Date;
  updatedAt: Date;
}

const postSchema = new Schema<IPost>(
  {
    content: {
      type: String,
      required: [true, 'Content is required'],
      trim: true,
    },
    senderId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'Sender ID is required'],
    },
  },
  {
    timestamps: true,
  }
);

const Post = mongoose.model<IPost>('Post', postSchema);

export default Post;

