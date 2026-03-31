const express = require('express');
const jwt = require('jsonwebtoken');
const Recipe = require('../models/Recipe');
const User = require('../models/User');

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

async function verifyRecipeAccess(recipeId, userId) {
  const recipe = await Recipe.findById(recipeId).lean();
  if (!recipe) return { status: 404, error: 'Recipe not found' };

  const user = await User.findById(userId).lean();
  if (recipe.createdBy !== userId && (!user || user.role !== 'admin')) {
    return { status: 403, error: 'Unauthorized' };
  }
  return null;
}

// Get nutrition info for a recipe
router.get('/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const recipe = await Recipe.findById(recipeId).select('nutrition').lean();

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }
    if (!recipe.nutrition || Object.keys(recipe.nutrition).length === 0) {
      return res.status(404).json({ error: 'Nutrition info not found' });
    }

    res.json({ recipeId, ...recipe.nutrition });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get scaled nutrition info based on servings
router.get('/:recipeId/scaled/:servings', async (req, res) => {
  try {
    const { recipeId, servings } = req.params;
    const recipe = await Recipe.findById(recipeId).select('servings nutrition').lean();

    if (!recipe) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const n = recipe.nutrition || {};
    const scaleFactor = parseInt(servings) / recipe.servings;

    const scaledNutrition = {
      recipeId,
      originalServings: recipe.servings,
      targetServings: parseInt(servings),
      scaleFactor: scaleFactor.toFixed(2),
      calories: n.calories ? (n.calories * scaleFactor).toFixed(2) : null,
      protein: n.protein ? (n.protein * scaleFactor).toFixed(2) : null,
      fat: n.fat ? (n.fat * scaleFactor).toFixed(2) : null,
      carbs: n.carbs ? (n.carbs * scaleFactor).toFixed(2) : null,
      fiber: n.fiber ? (n.fiber * scaleFactor).toFixed(2) : null
    };

    res.json(scaledNutrition);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add nutrition info for a recipe
router.post('/', verifyToken, async (req, res) => {
  try {
    const { recipeId, calories, protein, fat, carbs, fiber } = req.body;

    if (!recipeId) {
      return res.status(400).json({ error: 'recipeId is required' });
    }

    const accessError = await verifyRecipeAccess(recipeId, req.user.userId);
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    await Recipe.findByIdAndUpdate(recipeId, {
      nutrition: { calories, protein, fat, carbs, fiber }
    });

    res.status(201).json({ message: 'Nutrition info added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update nutrition info
router.put('/:recipeId', verifyToken, async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { calories, protein, fat, carbs, fiber } = req.body;

    const accessError = await verifyRecipeAccess(recipeId, req.user.userId);
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    const result = await Recipe.findByIdAndUpdate(recipeId, {
      nutrition: { calories, protein, fat, carbs, fiber }
    });

    if (!result) {
      return res.status(404).json({ error: 'Nutrition record not found' });
    }

    res.json({ message: 'Nutrition info updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
