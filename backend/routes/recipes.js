const express = require('express');
const jwt = require('jsonwebtoken');
const mongoose = require('mongoose');
const Recipe = require('../models/Recipe');
const Tag = require('../models/Tag');
const Rating = require('../models/Rating');
const User = require('../models/User');
const Comment = require('../models/Comment');
const Favorite = require('../models/Favorite');

const router = express.Router();

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

function verifyAdmin(req, res, next) {
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

// Helper: format recipe for API response
function formatRecipeResponse(recipe) {
  const obj = recipe.toJSON ? recipe.toJSON() : { ...recipe };
  if (obj._id && !obj.id) {
    obj.id = obj._id;
    delete obj._id;
  }
  delete obj.__v;
  if (obj.tags) {
    obj.tags = obj.tags.map(t => {
      if (t && t._id) return { id: t._id, name: t.name };
      if (t && t.id) return { id: t.id, name: t.name };
      return t;
    });
  }
  return obj;
}

// Admin review - list recipes by status
router.get('/admin/review', verifyAdmin, async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    let filter = {};
    if (status !== 'all') filter.status = status;

    const recipes = await Recipe.find(filter)
      .populate('tags')
      .sort({ createdAt: -1 })
      .lean();

    for (const recipe of recipes) {
      if (recipe.createdBy) {
        const user = await User.findById(recipe.createdBy).select('username email').lean();
        recipe.creatorName = user?.username || null;
        recipe.creatorEmail = user?.email || null;
      }
      recipe.id = recipe._id;
      delete recipe._id;
      delete recipe.__v;
      if (recipe.tags) {
        recipe.tags = recipe.tags.map(t => ({ id: t._id, name: t.name }));
      }
    }

    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update recipe status (approve/reject)
router.patch('/:id/status', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const { status, adminFeedback = '' } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ error: 'Status must be approved or rejected' });
    }

    const recipe = await Recipe.findByIdAndUpdate(id, {
      status,
      adminFeedback,
      reviewedBy: req.user.userId,
      reviewedAt: new Date()
    });

    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    res.json({ message: `Recipe ${status} successfully` });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// User's own submissions
router.get('/my/submissions/:userId', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    if (req.user.userId !== userId) {
      return res.status(403).json({ error: 'You can only view your own submissions' });
    }

    const recipes = await Recipe.find({ createdBy: userId })
      .populate('tags')
      .sort({ createdAt: -1 })
      .lean();

    for (const recipe of recipes) {
      const stats = await Rating.aggregate([
        { $match: { recipeId: recipe._id } },
        { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
      ]);
      recipe.averageRating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
      recipe.totalRatings = stats[0]?.count || 0;
      recipe.id = recipe._id;
      delete recipe._id;
      delete recipe.__v;
      if (recipe.tags) {
        recipe.tags = recipe.tags.map(t => ({ id: t._id, name: t.name }));
      }
    }

    res.json(recipes);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all approved recipes with filters
router.get('/', async (req, res) => {
  try {
    const {
      difficulty, maxTime, maxBudget, ingredientQuery,
      tags, tag, search, sort = 'newest',
      limit = 20, offset = 0
    } = req.query;

    // Build match filter
    let matchStage = { status: 'approved' };

    if (difficulty) matchStage.difficulty = difficulty;
    if (maxTime) matchStage.cookingTime = { $lte: parseInt(maxTime) };
    if (maxBudget) {
      matchStage.$and = matchStage.$and || [];
      matchStage.$and.push(
        { estimatedCost: { $ne: null } },
        { estimatedCost: { $lte: parseFloat(maxBudget) } }
      );
    }
    if (search) {
      const escapedSearch = search.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedSearch, 'i');
      matchStage.$or = [{ name: searchRegex }, { description: searchRegex }];
    }

    // Tag filter
    let selectedTags = [];
    if (tags) selectedTags = Array.isArray(tags) ? tags : [tags];
    else if (tag) selectedTags = [tag];

    if (selectedTags.length > 0) {
      const tagDocs = await Tag.find({ name: { $in: selectedTags } }).lean();
      const tagIds = tagDocs.map(t => t._id);
      if (tagIds.length > 0) {
        matchStage.tags = { $all: tagIds };
      }
    }

    // Ingredient filter
    if (ingredientQuery) {
      const terms = ingredientQuery.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
      if (terms.length > 0) {
        matchStage.$and = matchStage.$and || [];
        terms.forEach(term => {
          matchStage.$and.push({
            'ingredients.name': { $regex: term, $options: 'i' }
          });
        });
      }
    }

    // Build aggregation pipeline
    const pipeline = [
      { $match: matchStage },
      {
        $lookup: {
          from: 'ratings',
          localField: '_id',
          foreignField: 'recipeId',
          as: '_ratings'
        }
      },
      {
        $addFields: {
          averageRating: {
            $round: [{ $ifNull: [{ $avg: '$_ratings.rating' }, 0] }, 1]
          },
          totalRatings: { $size: '$_ratings' }
        }
      },
      { $project: { _ratings: 0 } }
    ];

    // Sort
    let sortStage;
    if (sort === 'rating') sortStage = { averageRating: -1, totalRatings: -1 };
    else if (sort === 'popular') sortStage = { totalRatings: -1 };
    else if (sort === 'quickest') sortStage = { cookingTime: 1 };
    else sortStage = { createdAt: -1 };
    pipeline.push({ $sort: sortStage });

    // Pagination
    pipeline.push({ $skip: parseInt(offset) });
    pipeline.push({ $limit: parseInt(limit) });

    // Populate tags
    pipeline.push({
      $lookup: {
        from: 'tags',
        localField: 'tags',
        foreignField: '_id',
        as: 'tags'
      }
    });

    const recipes = await Recipe.aggregate(pipeline);

    // Format response
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

// Get recipe by ID with full details
router.get('/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const requesterUserId = req.query.userId;

    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(404).json({ error: 'Recipe not found' });
    }

    const recipe = await Recipe.findById(id).populate('tags').lean();
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    if (recipe.status !== 'approved' && recipe.createdBy !== requesterUserId) {
      return res.status(403).json({ error: 'Recipe is not available for public viewing' });
    }

    // Get rating stats
    const stats = await Rating.aggregate([
      { $match: { recipeId: recipe._id } },
      { $group: { _id: null, avg: { $avg: '$rating' }, count: { $sum: 1 } } }
    ]);
    recipe.averageRating = stats[0] ? Math.round(stats[0].avg * 10) / 10 : 0;
    recipe.totalRatings = stats[0]?.count || 0;

    // Format response
    recipe.id = recipe._id;
    delete recipe._id;
    delete recipe.__v;

    if (recipe.tags) {
      recipe.tags = recipe.tags.map(t => ({ id: t._id, name: t.name }));
    }
    if (recipe.ingredients) {
      recipe.ingredients = recipe.ingredients.map(ing => ({
        id: ing._id,
        recipeId: recipe.id,
        name: ing.name,
        quantity: ing.quantity,
        unit: ing.unit
      }));
    }
    if (recipe.steps) {
      recipe.steps = recipe.steps.map(s => ({
        id: s._id,
        recipeId: recipe.id,
        stepNumber: s.stepNumber,
        description: s.description
      }));
    }
    if (recipe.nutrition && (recipe.nutrition.calories || recipe.nutrition.protein || recipe.nutrition.fat || recipe.nutrition.carbs || recipe.nutrition.fiber)) {
      recipe.nutrition = {
        recipeId: recipe.id,
        ...recipe.nutrition
      };
    } else {
      recipe.nutrition = null;
    }

    res.json(recipe);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Add new recipe (requires authentication)
router.post('/', verifyToken, async (req, res) => {
  try {
    const { name, description, difficulty, cookingTime, servings, estimatedCost, image, ingredients, steps, nutrition, tags: tagInput } = req.body;
    const userId = req.user.userId;

    if (!name || !difficulty) {
      return res.status(400).json({ error: 'Name and difficulty are required' });
    }

    let ingredientsList = [];
    let stepsList = [];
    let nutritionData = null;
    let tagsList = [];

    try {
      if (ingredients && typeof ingredients === 'string') ingredientsList = JSON.parse(ingredients);
      else if (Array.isArray(ingredients)) ingredientsList = ingredients;

      if (steps && typeof steps === 'string') stepsList = JSON.parse(steps);
      else if (Array.isArray(steps)) stepsList = steps;

      if (nutrition && typeof nutrition === 'string' && nutrition !== 'null') nutritionData = JSON.parse(nutrition);
      else if (nutrition && typeof nutrition === 'object') nutritionData = nutrition;

      if (tagInput && typeof tagInput === 'string') tagsList = JSON.parse(tagInput);
      else if (Array.isArray(tagInput)) tagsList = tagInput;
    } catch (parseErr) {
      console.error('Parse error:', parseErr);
    }

    const user = await User.findById(userId);
    if (!user) return res.status(404).json({ error: 'User not found' });

    const recipeStatus = user.role === 'admin' ? 'approved' : 'pending';

    // Resolve tag IDs
    const tagIds = [];
    for (const tagName of tagsList) {
      const tag = await Tag.findOneAndUpdate(
        { name: tagName },
        { name: tagName },
        { upsert: true, new: true }
      );
      tagIds.push(tag._id);
    }

    // Format steps with stepNumber
    const formattedSteps = (Array.isArray(stepsList) ? stepsList : []).map((step, index) => {
      if (typeof step === 'string') return { stepNumber: index + 1, description: step };
      return { stepNumber: step.stepNumber || index + 1, description: step.description || step };
    });

    const recipe = await Recipe.create({
      name,
      description,
      difficulty,
      cookingTime,
      servings,
      estimatedCost: estimatedCost || null,
      status: recipeStatus,
      image: image || 'https://via.placeholder.com/400x300',
      createdBy: userId,
      ingredients: ingredientsList,
      steps: formattedSteps,
      nutrition: nutritionData || undefined,
      tags: tagIds
    });

    res.status(201).json({
      id: recipe._id,
      status: recipeStatus,
      message: recipeStatus === 'approved' ? 'Recipe created successfully' : 'Recipe submitted for admin review',
      createdBy: userId,
      createdAt: recipe.createdAt.toISOString()
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Update recipe
router.put('/:id', verifyToken, async (req, res) => {
  try {
    const { id } = req.params;
    const { name, description, difficulty, cookingTime, servings, estimatedCost } = req.body;

    const recipe = await Recipe.findById(id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    const user = await User.findById(req.user.userId);
    if (recipe.createdBy !== req.user.userId && user?.role !== 'admin') {
      return res.status(403).json({ error: 'Unauthorized' });
    }

    await Recipe.findByIdAndUpdate(id, {
      name, description, difficulty, cookingTime, servings,
      estimatedCost: estimatedCost || null
    });

    res.json({ message: 'Recipe updated successfully' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Delete recipe (Admin only)
router.delete('/:id', verifyAdmin, async (req, res) => {
  try {
    const { id } = req.params;
    const recipe = await Recipe.findByIdAndDelete(id);
    if (!recipe) return res.status(404).json({ error: 'Recipe not found' });

    // Clean up related data
    await Rating.deleteMany({ recipeId: id });
    await Comment.deleteMany({ recipeId: id });
    await Favorite.deleteMany({ recipeId: id });

    res.json({ message: 'Recipe deleted successfully by admin' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
