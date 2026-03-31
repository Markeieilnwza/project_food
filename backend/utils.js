// Utility functions for the FoodShare backend
// Helper functions for common operations

// Format serving size for display
function formatServings(quantity) {
  if (quantity % 1 === 0) return quantity;
  return parseFloat(quantity.toFixed(2));
}

// Format cooking time display
function formatCookingTime(minutes) {
  if (minutes < 60) return `${minutes} mins`;
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;
  return mins > 0 ? `${hours}h ${mins}m` : `${hours}h`;
}

// Get difficulty color for UI
function getDifficultyColor(difficulty) {
  const colors = {
    'Easy': '#10b981',      // Green
    'Medium': '#f59e0b',    // Amber
    'Hard': '#ef4444'       // Red
  };
  return colors[difficulty] || '#6b7280';
}

// Get difficulty level value (for sorting)
function getDifficultyValue(difficulty) {
  const values = {
    'Easy': 1,
    'Medium': 2,
    'Hard': 3
  };
  return values[difficulty] || 0;
}

// Validate recipe data
function validateRecipeData(data) {
  const errors = [];
  
  if (!data.name || data.name.trim() === '') {
    errors.push('Recipe name is required');
  }
  
  if (!data.difficulty || !['Easy', 'Medium', 'Hard'].includes(data.difficulty)) {
    errors.push('Valid difficulty level is required (Easy, Medium, Hard)');
  }
  
  if (data.cookingTime && (data.cookingTime < 1 || data.cookingTime > 1440)) {
    errors.push('Cooking time must be between 1 and 1440 minutes');
  }
  
  if (data.servings && (data.servings < 1 || data.servings > 100)) {
    errors.push('Servings must be between 1 and 100');
  }
  
  if (data.ingredients && Array.isArray(data.ingredients)) {
    data.ingredients.forEach((ing, i) => {
      if (!ing.name || ing.name.trim() === '') {
        errors.push(`Ingredient ${i + 1}: name is required`);
      }
      if (!ing.quantity || ing.quantity <= 0) {
        errors.push(`Ingredient ${i + 1}: quantity must be greater than 0`);
      }
    });
  }
  
  return errors;
}

// Validate ingredient data
function validateIngredient(ingredient) {
  const errors = [];
  
  if (!ingredient.name || ingredient.name.trim() === '') {
    errors.push('Ingredient name is required');
  }
  
  if (!ingredient.quantity || ingredient.quantity <= 0) {
    errors.push('Ingredient quantity must be greater than 0');
  }
  
  return errors;
}

// Calculate scale factor
function calculateScaleFactor(originalServings, targetServings) {
  if (!originalServings || originalServings <= 0) {
    return 1;
  }
  return targetServings / originalServings;
}

// Scale nutrition values
function scaleNutrition(nutrition, factor) {
  return {
    ...nutrition,
    calories: nutrition.calories ? (nutrition.calories * factor).toFixed(2) : null,
    protein: nutrition.protein ? (nutrition.protein * factor).toFixed(2) : null,
    fat: nutrition.fat ? (nutrition.fat * factor).toFixed(2) : null,
    carbs: nutrition.carbs ? (nutrition.carbs * factor).toFixed(2) : null,
    fiber: nutrition.fiber ? (nutrition.fiber * factor).toFixed(2) : null
  };
}

// Get macro distribution percentages
function getMacroPercentages(calories, protein, fat, carbs) {
  const proteinCals = protein * 4;  // 4 cal per gram
  const fatCals = fat * 9;          // 9 cal per gram
  const carbsCals = carbs * 4;      // 4 cal per gram
  const total = proteinCals + fatCals + carbsCals;
  
  if (total === 0) return { protein: 0, fat: 0, carbs: 0 };
  
  return {
    protein: ((proteinCals / total) * 100).toFixed(1),
    fat: ((fatCals / total) * 100).toFixed(1),
    carbs: ((carbsCals / total) * 100).toFixed(1)
  };
}

// Filter recipes by criteria
function filterRecipes(recipes, criteria) {
  return recipes.filter(recipe => {
    // Difficulty filter
    if (criteria.difficulty && recipe.difficulty !== criteria.difficulty) {
      return false;
    }
    
    // Cooking time filter
    if (criteria.maxTime && recipe.cookingTime > criteria.maxTime) {
      return false;
    }
    
    if (criteria.minTime && recipe.cookingTime < criteria.minTime) {
      return false;
    }
    
    // Tags filter
    if (criteria.tags && criteria.tags.length > 0) {
      const hasTag = criteria.tags.some(tag =>
        recipe.tags && recipe.tags.some(recipeTag => recipeTag.name === tag)
      );
      if (!hasTag) return false;
    }
    
    return true;
  });
}

// Sort recipes
function sortRecipes(recipes, sortBy = 'name') {
  const sorted = [...recipes];
  
  switch (sortBy) {
    case 'name':
      sorted.sort((a, b) => a.name.localeCompare(b.name));
      break;
    case 'time-asc':
      sorted.sort((a, b) => a.cookingTime - b.cookingTime);
      break;
    case 'time-desc':
      sorted.sort((a, b) => b.cookingTime - a.cookingTime);
      break;
    case 'difficulty':
      sorted.sort((a, b) => getDifficultyValue(a.difficulty) - getDifficultyValue(b.difficulty));
      break;
    default:
      break;
  }
  
  return sorted;
}

// Format nutrition label
function formatNutritionLabel(nutrition, servings = 1) {
  return `
    Nutrition Facts (per ${servings} serving${servings !== 1 ? 's' : ''})
    Calories: ${nutrition.calories || 'N/A'}
    Protein: ${nutrition.protein || 'N/A'}g
    Fat: ${nutrition.fat || 'N/A'}g
    Carbs: ${nutrition.carbs || 'N/A'}g
    Fiber: ${nutrition.fiber || 'N/A'}g
  `.trim();
}

// Check if recipe meets dietary requirements
function meetsDietaryRequirements(recipe, requirements = []) {
  if (!requirements || requirements.length === 0) return true;
  
  if (!recipe.tags) return false;
  
  const tagNames = recipe.tags.map(tag => tag.name || tag);
  return requirements.every(req => tagNames.includes(req));
}

// Get trending categories
function getTrendingCategories(recipes) {
  const categories = {};
  
  recipes.forEach(recipe => {
    if (recipe.tags) {
      recipe.tags.forEach(tag => {
        const tagName = tag.name || tag;
        categories[tagName] = (categories[tagName] || 0) + 1;
      });
    }
  });
  
  return Object.entries(categories)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([name, count]) => ({ name, count }));
}

// Error handler middleware
function errorHandler(err, req, res, next) {
  console.error('Error:', err);
  
  const status = err.status || 500;
  const message = err.message || 'Internal Server Error';
  
  res.status(status).json({
    error: message,
    status,
    timestamp: new Date().toISOString()
  });
}

// Rate limiting helper (simple implementation)
const rateLimitMap = new Map();

function rateLimit(req, res, next, maxRequests = 100, windowMs = 60000) {
  const key = req.ip;
  const now = Date.now();
  
  if (!rateLimitMap.has(key)) {
    rateLimitMap.set(key, []);
  }
  
  const requests = rateLimitMap.get(key);
  
  // Remove old requests outside the window
  const validRequests = requests.filter(time => now - time < windowMs);
  
  if (validRequests.length >= maxRequests) {
    return res.status(429).json({
      error: 'Too many requests, please try again later'
    });
  }
  
  validRequests.push(now);
  rateLimitMap.set(key, validRequests);
  next();
}

module.exports = {
  formatServings,
  formatCookingTime,
  getDifficultyColor,
  getDifficultyValue,
  validateRecipeData,
  validateIngredient,
  calculateScaleFactor,
  scaleNutrition,
  getMacroPercentages,
  filterRecipes,
  sortRecipes,
  formatNutritionLabel,
  meetsDietaryRequirements,
  getTrendingCategories,
  errorHandler,
  rateLimit
};
