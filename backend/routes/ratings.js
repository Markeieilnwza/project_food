const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Rating = require('../models/Rating');

const router = express.Router();

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Get recipe rating stats
router.get('/recipe/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;

    if (!mongoose.Types.ObjectId.isValid(recipeId)) {
      return res.json({
        averageRating: 0,
        totalRatings: 0,
        fiveStarCount: 0,
        fourStarCount: 0,
        threeStarCount: 0,
        twoStarCount: 0,
        oneStarCount: 0
      });
    }

    const result = await Rating.aggregate([
      { $match: { recipeId: new mongoose.Types.ObjectId(recipeId) } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalRatings: { $sum: 1 },
          fiveStarCount: { $sum: { $cond: [{ $eq: ['$rating', 5] }, 1, 0] } },
          fourStarCount: { $sum: { $cond: [{ $eq: ['$rating', 4] }, 1, 0] } },
          threeStarCount: { $sum: { $cond: [{ $eq: ['$rating', 3] }, 1, 0] } },
          twoStarCount: { $sum: { $cond: [{ $eq: ['$rating', 2] }, 1, 0] } },
          oneStarCount: { $sum: { $cond: [{ $eq: ['$rating', 1] }, 1, 0] } }
        }
      }
    ]);

    const stats = result[0] || {
      averageRating: 0,
      totalRatings: 0,
      fiveStarCount: 0,
      fourStarCount: 0,
      threeStarCount: 0,
      twoStarCount: 0,
      oneStarCount: 0
    };

    delete stats._id;
    res.json(stats);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get user's rating for a recipe
router.get('/user/:userId/recipe/:recipeId', verifyToken, async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const row = await Rating.findOne({ userId, recipeId }).lean();
    res.json({ rating: row ? row.rating : null });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add or update rating
router.post('/', verifyToken, async (req, res) => {
  try {
    const { recipeId, rating } = req.body;
    const userId = req.user.userId;

    if (!userId || !recipeId || !rating) {
      return res.status(400).json({ error: 'userId, recipeId, and rating are required' });
    }

    if (rating < 1 || rating > 5 || !Number.isInteger(rating)) {
      return res.status(400).json({ error: 'Rating must be an integer between 1 and 5' });
    }

    await Rating.findOneAndUpdate(
      { userId, recipeId },
      { userId, recipeId, rating },
      { upsert: true, new: true }
    );

    res.json({ message: 'Rating saved successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete rating
router.delete('/:userId/:recipeId', verifyToken, async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Rating.findOneAndDelete({ userId, recipeId });
    res.json({ message: 'Rating deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
