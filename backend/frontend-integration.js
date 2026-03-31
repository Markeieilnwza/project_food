// Frontend API Integration Guide
// Copy this to your frontend project

const API_URL = 'http://localhost:3000/api';

// ==================== RECIPES ====================

// Get all recipes
async function getAllRecipes(filters = {}) {
  const params = new URLSearchParams();
  if (filters.difficulty) params.append('difficulty', filters.difficulty);
  if (filters.maxTime) params.append('maxTime', filters.maxTime);
  if (filters.tag) params.append('tag', filters.tag);
  
  const response = await fetch(`${API_URL}/recipes?${params}`);
  return await response.json();
}

// Get recipe details
async function getRecipeDetails(recipeId) {
  const response = await fetch(`${API_URL}/recipes/${recipeId}`);
  return await response.json();
}

// Create recipe
async function createRecipe(recipeData) {
  const response = await fetch(`${API_URL}/recipes`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipeData)
  });
  return await response.json();
}

// Update recipe
async function updateRecipe(recipeId, recipeData) {
  const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(recipeData)
  });
  return await response.json();
}

// Delete recipe
async function deleteRecipe(recipeId) {
  const response = await fetch(`${API_URL}/recipes/${recipeId}`, {
    method: 'DELETE'
  });
  return await response.json();
}

// ==================== SEARCH ====================

// Advanced search
async function searchRecipes(searchTerm, filters = {}) {
  const params = new URLSearchParams();
  if (searchTerm) params.append('q', searchTerm);
  if (filters.difficulty) params.append('difficulty', filters.difficulty);
  if (filters.minTime) params.append('minTime', filters.minTime);
  if (filters.maxTime) params.append('maxTime', filters.maxTime);
  if (filters.tags) params.append('tags', filters.tags.join(','));
  
  const response = await fetch(`${API_URL}/search?${params}`);
  return await response.json();
}

// Search by available ingredients
async function searchByIngredients(ingredients) {
  const response = await fetch(`${API_URL}/search/by-ingredients`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ ingredients })
  });
  return await response.json();
}

// ==================== INGREDIENTS ====================

// Get recipe ingredients
async function getIngredients(recipeId) {
  const response = await fetch(`${API_URL}/ingredients/recipe/${recipeId}`);
  return await response.json();
}

// Scale ingredients
async function scaleIngredients(recipeId, servings) {
  const response = await fetch(`${API_URL}/ingredients/scale/${recipeId}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ servings })
  });
  return await response.json();
}

// ==================== NUTRITION ====================

// Get nutrition info
async function getNutrition(recipeId) {
  const response = await fetch(`${API_URL}/nutrition/${recipeId}`);
  return await response.json();
}

// Get scaled nutrition
async function getScaledNutrition(recipeId, servings) {
  const response = await fetch(`${API_URL}/nutrition/${recipeId}/scaled/${servings}`);
  return await response.json();
}

// ==================== TAGS ====================

// Get all tags
async function getAllTags() {
  const response = await fetch(`${API_URL}/tags`);
  return await response.json();
}

// Get recipe tags
async function getRecipeTags(recipeId) {
  const response = await fetch(`${API_URL}/tags/recipe/${recipeId}`);
  return await response.json();
}

// Add tag to recipe
async function addTagToRecipe(recipeId, tagName) {
  const response = await fetch(`${API_URL}/tags`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ recipeId, tagName })
  });
  return await response.json();
}

// ==================== FAVORITES ====================

// Get user's favorites
async function getFavorites(userId) {
  const response = await fetch(`${API_URL}/favorites/${userId}`);
  return await response.json();
}

// Check if recipe is favorite
async function isFavorite(userId, recipeId) {
  const response = await fetch(`${API_URL}/favorites/${userId}/${recipeId}/check`);
  const data = await response.json();
  return data.isFavorite;
}

// Add to favorites
async function addToFavorites(userId, recipeId) {
  const response = await fetch(`${API_URL}/favorites`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ userId, recipeId })
  });
  return await response.json();
}

// Remove from favorites
async function removeFromFavorites(userId, recipeId) {
  const response = await fetch(`${API_URL}/favorites/${userId}/${recipeId}`, {
    method: 'DELETE'
  });
  return await response.json();
}

// ==================== USAGE EXAMPLES ====================

/*
// Example 1: Get all recipes
const recipes = await getAllRecipes();
console.log(recipes);

// Example 2: Search with filters
const results = await searchRecipes('pasta', {
  difficulty: 'Easy',
  maxTime: 30,
  tags: ['Vegetarian', 'Quick']
});

// Example 3: Scale ingredients
const scaled = await scaleIngredients(1, 6);
console.log(scaled.ingredients);

// Example 4: Get scaled nutrition
const nutrition = await getScaledNutrition(1, 6);
console.log(`Calories: ${nutrition.calories}`);

// Example 5: Manage favorites
const userId = 'user123';
await addToFavorites(userId, 1);
const myFavorites = await getFavorites(userId);
*/

// Export all functions
export {
  getAllRecipes,
  getRecipeDetails,
  createRecipe,
  updateRecipe,
  deleteRecipe,
  searchRecipes,
  searchByIngredients,
  getIngredients,
  scaleIngredients,
  getNutrition,
  getScaledNutrition,
  getAllTags,
  getRecipeTags,
  addTagToRecipe,
  getFavorites,
  isFavorite,
  addToFavorites,
  removeFromFavorites
};
