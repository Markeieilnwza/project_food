const express = require('express');
const jwt = require('jsonwebtoken');
const router = express.Router();
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

// Get ingredients for a recipe
router.get('/recipe/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const recipe = await Recipe.findById(recipeId).select('ingredients').lean();
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const ingredients = (recipe.ingredients || []).map(ing => ({
      id: ing._id,
      recipeId,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit
    }));

    res.json(ingredients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Scale ingredients (Smart Ingredient Scaling)
router.post('/scale/:recipeId', async (req, res) => {
  try {
    const { recipeId } = req.params;
    const { servings } = req.body;

    if (!servings || servings <= 0) {
      return res.status(400).json({ error: 'Valid servings number is required' });
    }

    const recipe = await Recipe.findById(recipeId).select('servings ingredients').lean();
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const scaleFactor = servings / recipe.servings;

    const scaledIngredients = (recipe.ingredients || []).map(ing => ({
      id: ing._id,
      recipeId,
      name: ing.name,
      quantity: ing.quantity,
      unit: ing.unit,
      originalQuantity: ing.quantity,
      scaledQuantity: (ing.quantity * scaleFactor).toFixed(2),
      scaleFactor
    }));

    res.json({
      recipeId,
      originalServings: recipe.servings,
      targetServings: servings,
      scaleFactor: scaleFactor.toFixed(2),
      ingredients: scaledIngredients
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add ingredient to recipe
router.post('/', verifyToken, async (req, res) => {
  try {
    const { recipeId, name, quantity, unit } = req.body;

    if (!recipeId || !name || !quantity) {
      return res.status(400).json({ error: 'recipeId, name, and quantity are required' });
    }

    const accessError = await verifyRecipeAccess(recipeId, req.user.userId);
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    const recipe = await Recipe.findByIdAndUpdate(
      recipeId,
      { $push: { ingredients: { name, quantity, unit } } },
      { new: true }
    );

    const newIngredient = recipe.ingredients[recipe.ingredients.length - 1];

    res.status(201).json({ id: newIngredient._id, message: 'Ingredient added successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete ingredient
router.delete('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;

    // Find recipe containing this ingredient
    const recipe = await Recipe.findOne({ 'ingredients._id': id });
    if (!recipe) return res.status(404).json({ error: 'Ingredient not found' });

    const accessError = await verifyRecipeAccess(recipe._id, req.user.userId);
    if (accessError) return res.status(accessError.status).json({ error: accessError.error });

    await Recipe.findByIdAndUpdate(recipe._id, {
      $pull: { ingredients: { _id: id } }
    });

    res.json({ message: 'Ingredient deleted successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
