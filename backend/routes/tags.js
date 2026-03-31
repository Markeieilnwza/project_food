const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
const Tag = require('../models/Tag');
const Recipe = require('../models/Recipe');
const User = require('../models/User');

function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];
  if (!token) return res.status(401).json({ error: 'Token required' });
  try {
    req.user = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function verifyRecipeAccess(recipeId, userId) {
  const recipe = await Recipe.findById(recipeId);
  if (!recipe) return { status: 404, error: 'Recipe not found' };
  const user = await User.findById(userId).select('role');
  if (recipe.createdBy !== userId && user?.role !== 'admin') {
    return { status: 403, error: 'Unauthorized' };
  }
  return null;
}

// Get all tags
router.get('/', async (req, res) => {
  try {
    const tags = await Tag.find().sort({ name: 1 }).lean();
    const formatted = tags.map(t => ({ id: t._id, name: t.name }));
    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get tags for a recipe
router.get('/recipe/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const recipe = await Recipe.findById(recipeId).populate('tags').lean();
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const tags = (recipe.tags || []).map(t => ({ id: t._id, name: t.name }));
    res.json(tags);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add tag to recipe
router.post('/', verifyToken, async (req, res) => {
  try {
    const { recipeId, tagName } = req.body;

    if (!recipeId || !tagName) {
      return res.status(400).json({ error: 'recipeId and tagName are required' });
    }

    const accessError = await verifyRecipeAccess(recipeId, req.user.userId);
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    // Create tag if not exists
    const tag = await Tag.findOneAndUpdate(
      { name: tagName },
      { name: tagName },
      { upsert: true, new: true }
    );

    // Add tag to recipe if not already added
    await Recipe.findByIdAndUpdate(recipeId, {
      $addToSet: { tags: tag._id }
    });

    res.status(201).json({ message: 'Tag added to recipe successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Remove tag from recipe
router.delete('/:recipeId/:tagId', verifyToken, async (req, res) => {
  try {
    const { recipeId, tagId } = req.params;

    const accessError = await verifyRecipeAccess(recipeId, req.user.userId);
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    await Recipe.findByIdAndUpdate(recipeId, {
      $pull: { tags: tagId }
    });

    res.json({ message: 'Tag removed from recipe successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
