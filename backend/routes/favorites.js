const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Favorite = require('../models/Favorite');
const Recipe = require('../models/Recipe');
const Tag = require('../models/Tag');

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

// Get user's favorite recipes
router.get('/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const favorites = await Favorite.find({ userId })
      .sort({ _id: -1 })
      .lean();

    const recipeIds = favorites.map(f => f.recipeId);
    const recipes = await Recipe.find({ _id: { $in: recipeIds } })
      .populate('tags')
      .lean();

    const formatted = recipes.map(r => {
      r.id = r._id;
      delete r._id;
      delete r.__v;
      if (r.tags) {
        r.tags = r.tags.map(t => ({ id: t._id, name: t.name }));
      }
      return r;
    });

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Check if recipe is in favorites
router.get('/:userId/:recipeId/check', verifyToken, async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const favorite = await Favorite.findOne({ userId, recipeId });
    res.json({ isFavorite: !!favorite });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add recipe to favorites
router.post('/', verifyToken, async (req, res) => {
  try {
    const { recipeId } = req.body;
    const userId = req.user.userId;

    if (!userId || !recipeId) {
      return res.status(400).json({ error: 'userId and recipeId are required' });
    }

    const favorite = await Favorite.create({ userId, recipeId });

    res.status(201).json({ id: favorite._id, message: 'Added to favorites' });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: 'Recipe already in favorites' });
    }
    res.status(500).json({ error: err.message });
  }
});

// Remove recipe from favorites
router.delete('/:userId/:recipeId', verifyToken, async (req, res) => {
  try {
    const { userId, recipeId } = req.params;

    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    const result = await Favorite.findOneAndDelete({ userId, recipeId });

    if (!result) {
      return res.status(404).json({ error: 'Favorite not found' });
    }

    res.json({ message: 'Removed from favorites' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
