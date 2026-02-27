import dotenv from 'dotenv';
import mongoose from 'mongoose';
import bcrypt from 'bcryptjs';
import User from './models/user';
import Post from './models/post';
import Comment from './models/comment';

dotenv.config();

const SEED_USERS = [
  { username: 'booklover', email: 'booklover@rebook.demo', password: 'seed123' },
  { username: 'readershare', email: 'readershare@rebook.demo', password: 'seed123' },
];

const POST_SAMPLES = [
  'Giving away: "The Great Gatsby" - good condition, pick up only.',
  'Recommendation: "1984" by Orwell - must read for everyone.',
  'Free: Programming books (JavaScript, TypeScript). Moving soon!',
  'Giving away: "Harry Potter" set, well loved but complete.',
  'Recommendation: "Sapiens" - changed how I see history.',
  'Free: Cookbook collection. Take one or all!',
  'Giving away: "Clean Code" by Robert Martin. Great for developers.',
  'Recommendation: "The Hobbit" - perfect for a cozy weekend.',
  'Free: Kids books (ages 5-8). Good condition.',
  'Giving away: "Design Patterns" - CS students welcome.',
  'Recommendation: "Atomic Habits" - small changes, big impact.',
  'Free: Romance novels, various authors.',
  'Giving away: "Eloquent JavaScript" - free online too but nice on shelf.',
  'Recommendation: "Dune" - epic sci-fi.',
  'Free: Textbooks from last semester (Math, Physics).',
  'Giving away: "Thinking, Fast and Slow" - psychology classic.',
  'Recommendation: "Project Hail Mary" - fun and clever.',
  'Free: Magazines (National Geographic, 2020-2022).',
  'Giving away: "The Pragmatic Programmer" - like new.',
  'Recommendation: "Educated" by Tara Westover - memoir, powerful.',
];

const COMMENT_SAMPLES = [
  "I'd love this one!",
  "Still available?",
  "Great recommendation, thanks!",
  "Interested! Where can I pick up?",
  "Added to my list.",
];

async function seed() {
  const uri = process.env.MONGODB_URI;
  if (!uri) {
    console.error('MONGODB_URI is required. Set it in .env');
    process.exit(1);
  }

  await mongoose.connect(uri);
  console.log('Connected to MongoDB');

  const userIds: mongoose.Types.ObjectId[] = [];

  for (const u of SEED_USERS) {
    let user = await User.findOne({ email: u.email });
    if (!user) {
      const hashed = await bcrypt.hash(u.password, 10);
      user = await User.create({ ...u, password: hashed });
      console.log('Created user:', user.username);
    } else {
      console.log('User already exists:', user.username);
    }
    userIds.push(user._id as mongoose.Types.ObjectId);
  }

  const existingPostCount = await Post.countDocuments();
  let postsCreated = 0;
  const postIds: mongoose.Types.ObjectId[] = [];

  if (existingPostCount >= POST_SAMPLES.length) {
    const existing = await Post.find().limit(POST_SAMPLES.length).sort({ createdAt: -1 });
    existing.forEach((p) => postIds.push(p._id as mongoose.Types.ObjectId));
    console.log('Using existing posts for comments.');
  } else {
    for (let i = 0; i < POST_SAMPLES.length; i++) {
      const senderId = userIds[i % userIds.length];
      const post = await Post.create({ content: POST_SAMPLES[i], senderId });
      postIds.push(post._id as mongoose.Types.ObjectId);
      postsCreated++;
    }
    console.log('Created', postsCreated, 'posts.');
  }

  const existingCommentCount = await Comment.countDocuments();
  let commentsCreated = 0;

  if (existingCommentCount < 10) {
    for (let i = 0; i < Math.min(postIds.length, 8); i++) {
      const postId = postIds[i];
      const numComments = 1 + (i % 3);
      for (let c = 0; c < numComments; c++) {
        const authorId = userIds[c % userIds.length];
        const content = COMMENT_SAMPLES[(i + c) % COMMENT_SAMPLES.length];
        await Comment.create({ postId, authorId, content });
        commentsCreated++;
      }
    }
    console.log('Created', commentsCreated, 'comments.');
  } else {
    console.log('Comments already present, skipping.');
  }

  await mongoose.disconnect();
  console.log('Seed done. You can log in with booklover@rebook.demo / seed123 or readershare@rebook.demo / seed123');
}

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
