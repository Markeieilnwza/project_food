const express = require('express');
const router = express.Router();
const Recipe = require('../models/Recipe');
const Tag = require('../models/Tag');

// Advanced search with multiple filters
router.get('/', async (req, res) => {
  try {
    const {
      q,
      difficulty,
      maxTime,
      minTime,
      tags,
      limit = 20,
      offset = 0
    } = req.query;

    let filter = { status: 'approved' };

    if (q) {
      const escapedQ = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      const searchRegex = new RegExp(escapedQ, 'i');
      filter.$or = [
        { name: searchRegex },
        { description: searchRegex },
        { 'ingredients.name': searchRegex }
      ];
    }

    if (difficulty) {
      const difficulties = difficulty.split(',').map(d => d.trim());
      filter.difficulty = { $in: difficulties };
    }

    if (maxTime) {
      filter.cookingTime = { ...(filter.cookingTime || {}), $lte: parseInt(maxTime) };
    }

    if (minTime) {
      filter.cookingTime = { ...(filter.cookingTime || {}), $gte: parseInt(minTime) };
    }

    if (tags) {
      const tagList = tags.split(',').map(t => t.trim());
      const tagDocs = await Tag.find({ name: { $in: tagList } }).lean();
      const tagIds = tagDocs.map(t => t._id);
      if (tagIds.length > 0) {
        filter.tags = { $in: tagIds };
      }
    }

    const recipes = await Recipe.find(filter)
      .populate('tags')
      .skip(parseInt(offset))
      .limit(parseInt(limit))
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

// Search by budget (simplified - fewer ingredients = cheaper)
router.get('/budget/:maxCost', async (req, res) => {
  try {
    const { maxCost } = req.params;
    const { limit = 20, offset = 0 } = req.query;

    const recipes = await Recipe.aggregate([
      { $match: { status: 'approved' } },
      {
        $addFields: {
          ingredientCount: { $size: { $ifNull: ['$ingredients', []] } }
        }
      },
      { $match: { ingredientCount: { $lte: parseInt(maxCost) } } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) },
      {
        $lookup: {
          from: 'tags',
          localField: 'tags',
          foreignField: '_id',
          as: 'tags'
        }
      }
    ]);

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

// Search by available ingredients
router.post('/by-ingredients', async (req, res) => {
  try {
    const { ingredients, limit = 20, offset = 0 } = req.body;

    if (!ingredients || !Array.isArray(ingredients) || ingredients.length === 0) {
      return res.status(400).json({ error: 'Array of ingredient names is required' });
    }

    const ingredientPatterns = ingredients.map(ing => new RegExp(ing.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i'));

    const recipes = await Recipe.aggregate([
      { $match: { status: 'approved' } },
      { $unwind: '$ingredients' },
      {
        $match: {
          $or: ingredientPatterns.map(pattern => ({
            'ingredients.name': pattern
          }))
        }
      },
      {
        $group: {
          _id: '$_id',
          doc: { $first: '$$ROOT' },
          matchingIngredients: { $sum: 1 }
        }
      },
      { $sort: { matchingIngredients: -1 } },
      { $skip: parseInt(offset) },
      { $limit: parseInt(limit) },
      { $replaceRoot: { newRoot: { $mergeObjects: ['$doc', { matchingIngredients: '$matchingIngredients' }] } } }
    ]);

    // Re-fetch with populated tags
    const recipeIds = recipes.map(r => r._id);
    const fullRecipes = await Recipe.find({ _id: { $in: recipeIds } })
      .populate('tags')
      .lean();

    const formatted = fullRecipes.map(r => {
      const match = recipes.find(m => m._id.toString() === r._id.toString());
      r.matchingIngredients = match?.matchingIngredients || 0;
      r.id = r._id;
      delete r._id;
      delete r.__v;
      if (r.tags) {
        r.tags = r.tags.map(t => ({ id: t._id, name: t.name }));
      }
      return r;
    });

    // Sort by matching count
    formatted.sort((a, b) => b.matchingIngredients - a.matchingIngredients);

    res.json(formatted);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
