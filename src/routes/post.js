const express = require('express');
const router = express.Router();
const postController = require('../controllers/post');

router.post('/', postController.createPost);
router.get('/', postController.getAllPosts);
router.get('/:id', postController.getPostById);
router.put('/:id', postController.updatePost);

module.exports = router;
