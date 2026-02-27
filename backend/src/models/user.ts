import mongoose, { Document, Schema } from 'mongoose';

export interface IUser extends Document {
  username: string;
  email: string;
  password: string;
  refreshToken?: string;
  profilePicturePath?: string;
  googleId?: string;
  createdAt: Date;
  updatedAt: Date;
}

const userSchema = new Schema<IUser>(
  {
    username: {
      type: String,
      required: [true, 'Username is required'],
      unique: true,
      trim: true,
      minlength: [3, 'Username must be at least 3 characters'],
      maxlength: [30, 'Username cannot exceed 30 characters'],
    },
    email: {
      type: String,
      required: [true, 'Email is required'],
      unique: true,
      trim: true,
      lowercase: true,
      match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email address'],
    },
    password: {
      type: String,
      required: [true, 'Password is required'],
      minlength: [6, 'Password must be at least 6 characters'],
      select: false,
    },
    refreshToken: {
      type: String,
      default: undefined,
    },
    profilePicturePath: {
      type: String,
      default: undefined,
    },
    googleId: {
      type: String,
      default: undefined,
      sparse: true,
    },
  },
  {
    timestamps: true,
  }
);

const User = mongoose.model<IUser>('User', userSchema);

export default User;
