const Comment = require("../models/comment");

const createComment = async (req, res) => {
  try {
    const { postId, content, authorId } = req.body;
    const comment = new Comment({ postId, content, authorId });
    const savedComment = await comment.save();
    res.status(201).json(savedComment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getCommentById = async (req, res) => {
  try {
    const comment = await Comment.findById(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const updateComment = async (req, res) => {
  try {
    const { content } = req.body;
    const comment = await Comment.findByIdAndUpdate(
      req.params.id,
      { content },
      { new: true, runValidators: true }
    );
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.json(comment);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const deleteComment = async (req, res) => {
  try {
    const comment = await Comment.findByIdAndDelete(req.params.id);
    if (!comment) {
      return res.status(404).json({ error: "Comment not found" });
    }
    res.json({ message: "Comment deleted successfully" });
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

const getCommentsByPostId = async (req, res) => {
  try {
    const { postId } = req.query;
    if (!postId) {
      return res.json([]);
    }
    const comments = await Comment.find({ postId });
    res.json(comments);
  } catch (error) {
    res.status(400).json({ error: error.message });
  }
};

module.exports = {
  createComment,
  getCommentById,
  updateComment,
  deleteComment,
  getCommentsByPostId,
};
