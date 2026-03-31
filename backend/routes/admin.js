const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const User = require('../models/User');
const Recipe = require('../models/Recipe');

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

async function verifyAdmin(req, res, next) {
  verifyToken(req, res, async () => {
    try {
      const user = await User.findById(req.user.userId);
      if (!user || user.role !== 'admin') {
        return res.status(403).json({ error: 'Admin access required' });
      }
      next();
    } catch (err) {
      return res.status(500).json({ error: 'Server error' });
    }
  });
}

// Search recipes (admin only)
router.get('/search-recipes', verifyAdmin, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query) {
      return res.status(400).json({ error: 'Search query required' });
    }

    const searchRegex = new RegExp(query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const recipes = await Recipe.find({
      $or: [{ name: searchRegex }, { description: searchRegex }]
    })
      .select('name difficulty cookingTime createdBy createdAt image status servings')
      .sort({ createdAt: -1 })
      .limit(50)
      .lean();

    // Lookup usernames for createdBy
    const userIds = [...new Set(recipes.map(r => r.createdBy).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id username').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id] = u.username; });

    const formatted = recipes.map(r => {
      r.id = r._id;
      r.creatorName = userMap[r.createdBy] || r.createdBy;
      delete r._id;
      delete r.__v;
      return r;
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Delete recipe (admin only)
router.delete('/recipes/:recipeId', verifyAdmin, async (req, res) => {
  try {
    const { recipeId } = req.params;

    const recipe = await Recipe.findByIdAndDelete(recipeId);

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    // Clean up related data
    const Rating = require('../models/Rating');
    const Comment = require('../models/Comment');
    const Favorite = require('../models/Favorite');
    await Rating.deleteMany({ recipeId });
    await Comment.deleteMany({ recipeId });
    await Favorite.deleteMany({ recipeId });

    res.json({ message: 'Recipe deleted successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get all recipes (admin dashboard)
router.get('/recipes', verifyAdmin, async (req, res) => {
  try {
    const recipes = await Recipe.find()
      .select('name difficulty cookingTime createdBy createdAt status image servings')
      .sort({ createdAt: -1 })
      .lean();

    // Lookup usernames for createdBy
    const userIds = [...new Set(recipes.map(r => r.createdBy).filter(Boolean))];
    const users = await User.find({ _id: { $in: userIds } }).select('_id username').lean();
    const userMap = {};
    users.forEach(u => { userMap[u._id] = u.username; });

    const formatted = recipes.map(r => {
      r.id = r._id;
      r.creatorName = userMap[r.createdBy] || r.createdBy;
      delete r._id;
      delete r.__v;
      return r;
    });

    res.json(formatted);
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Approve recipe (admin only)
router.patch('/recipes/:recipeId/approve', verifyAdmin, async (req, res) => {
  try {
    const { recipeId } = req.params;

    const recipe = await Recipe.findByIdAndUpdate(recipeId, {
      status: 'approved',
      reviewedAt: new Date()
    });

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    res.json({ message: 'Recipe approved successfully' });
  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
