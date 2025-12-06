const express = require("express");
const router = express.Router();
const {
  createComment,
  getCommentById,
  updateComment,
  deleteComment,
  getCommentsByPostId,
} = require("../controllers/comment");

router.post("/", createComment);
router.get("/", getCommentsByPostId);
router.get("/:id", getCommentById);
router.put("/:id", updateComment);
router.delete("/:id", deleteComment);

module.exports = router;
