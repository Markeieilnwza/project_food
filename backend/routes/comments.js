const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Comment = require('../models/Comment');
const User = require('../models/User');

function verifyToken(req, res, next) {
  try {
    const token = req.headers.authorization?.split(' ')[1];

    if (!token) {
      return res.status(401).json({ 
        error: 'Token required',
        message: 'Please provide a valid authorization token'
      });
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    console.log('[COMMENTS] DEBUG JWT Decoded:', decoded);
    req.user = decoded;
    next();
  } catch (error) {
    console.log('[COMMENTS] DEBUG JWT Error:', error.message);
    if (error.name === 'TokenExpiredError') {
      return res.status(401).json({ 
        error: 'Token expired',
        message: 'Please login again'
      });
    }
    return res.status(401).json({ 
      error: 'Invalid token',
      message: 'Please provide a valid authorization token'
    });
  }
}

// Get all comments for a recipe
router.get('/recipe/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;

    const comments = await Comment.find({ recipeId })
      .sort({ createdAt: -1 })
      .lean();

    const formatted = comments.map(c => ({
      id: c._id,
      userId: c.userId,
      username: c.username,
      text: c.text,
      createdAt: c.createdAt
    }));

    res.json(formatted);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Add comment
router.post('/', verifyToken, async (req, res) => {
  try {
    const { recipeId, text } = req.body;
    const userId = req.user.userId;
    const username = req.user.username;

    console.log('[COMMENTS] POST request body:', { recipeId, text, userId, username });

    if (!recipeId || !userId || !username || !text) {
      console.log('[COMMENTS] VALIDATION FAILED - Missing fields:', { 
        recipeId: !!recipeId, 
        userId: !!userId, 
        username: !!username, 
        text: !!text 
      });
      return res.status(400).json({ error: 'Missing required fields' });
    }

    if (text.length < 1 || text.length > 500) {
      return res.status(400).json({ error: 'Comment must be 1-500 characters' });
    }

    // Validate recipeId is a valid MongoDB ObjectId
    const mongoose = require('mongoose');
    if (!mongoose.Types.ObjectId.isValid(recipeId)) {
      console.log('[COMMENTS] Invalid recipeId format:', recipeId);
      return res.status(400).json({ error: 'Invalid recipe ID' });
    }

    console.log('[COMMENTS] About to create comment with:', { recipeId, userId, username, text });

    const comment = await Comment.create({
      recipeId: mongoose.Types.ObjectId(recipeId),
      userId,
      username,
      text
    });

    console.log('[COMMENTS] Comment created successfully:', comment);

    res.status(201).json({
      id: comment._id,
      recipeId: comment.recipeId,
      username,
      text,
      createdAt: comment.createdAt
    });
  } catch (error) {
    console.error('[COMMENTS] Error creating comment:', error.message);
    console.error('[COMMENTS] Full error:', error);
    res.status(500).json({ error: 'Server error: ' + error.message });
  }
});

// Delete comment (user can delete own, admin can delete any)
router.delete('/:commentId', verifyToken, async (req, res) => {
  try {
    const { commentId } = req.params;

    const comment = await Comment.findById(commentId);
    if (!comment) {
      return res.status(404).json({ error: 'Comment not found' });
    }

    // Check if user owns the comment or is admin
    const user = await User.findById(req.user.userId).select('role');

    if (comment.userId !== req.user.userId && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Comment.findByIdAndDelete(commentId);

    res.json({ message: 'Comment deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
