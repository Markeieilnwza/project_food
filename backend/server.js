require('dotenv').config();
const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const path = require('path');

// Import Mongoose models
const User = require('./models/User');
const Recipe = require('./models/Recipe');
const Tag = require('./models/Tag');

const app = express();
const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const REQUEST_BODY_LIMIT = process.env.REQUEST_BODY_LIMIT || '10mb';
const HOST = process.env.HOST || (NODE_ENV === 'production' ? '0.0.0.0' : 'localhost');
const frontendDir = path.join(__dirname, '..', 'frontend');

// ============ LOGGING SETUP ============
const logger = {
  info: (msg) => console.log(`[INFO] ${new Date().toISOString()} - ${msg}`),
  error: (msg) => console.error(`[ERROR] ${new Date().toISOString()} - ${msg}`),
  warn: (msg) => console.warn(`[WARN] ${new Date().toISOString()} - ${msg}`),
  debug: (msg) => console.log(`[DEBUG] ${new Date().toISOString()} - ${msg}`),
};

const sampleRecipes = [
  {
    name: 'Pad Thai',
    description: 'Classic Thai stir-fried noodles with shrimp, tamarind sauce, and crushed peanuts.',
    difficulty: 'Easy',
    cookingTime: 25,
    servings: 4,
    estimatedCost: 120,
    image: 'https://images.unsplash.com/photo-1559314809-0d155014e29e?auto=format&fit=crop&w=900&q=80',
    ingredients: [
      { name: 'Rice noodles', quantity: 200, unit: 'g' },
      { name: 'Shrimp', quantity: 180, unit: 'g' },
      { name: 'Bean sprouts', quantity: 120, unit: 'g' },
      { name: 'Eggs', quantity: 2, unit: 'pcs' }
    ],
    steps: [
      { stepNumber: 1, description: 'Soak noodles until soft.' },
      { stepNumber: 2, description: 'Stir-fry shrimp and eggs in a hot pan.' },
      { stepNumber: 3, description: 'Add noodles and sauce, then toss with bean sprouts.' },
      { stepNumber: 4, description: 'Serve with peanuts and lime.' }
    ],
    tagNames: ['Easy', 'Quick', 'Seafood', 'Sharing']
  },
  {
    name: 'Healthy Chicken Salad',
    description: 'Fresh grilled chicken salad with mixed greens and a light citrus dressing.',
    difficulty: 'Easy',
    cookingTime: 20,
    servings: 2,
    estimatedCost: 90,
    image: 'https://images.unsplash.com/photo-1546793665-c74683f339c1?auto=format&fit=crop&w=900&q=80',
    ingredients: [
      { name: 'Chicken breast', quantity: 200, unit: 'g' },
      { name: 'Mixed greens', quantity: 100, unit: 'g' },
      { name: 'Cherry tomatoes', quantity: 80, unit: 'g' },
      { name: 'Olive oil', quantity: 2, unit: 'tbsp' }
    ],
    steps: [
      { stepNumber: 1, description: 'Season and grill the chicken until cooked through.' },
      { stepNumber: 2, description: 'Slice the chicken into strips.' },
      { stepNumber: 3, description: 'Combine greens and tomatoes in a bowl.' },
      { stepNumber: 4, description: 'Top with chicken and dressing before serving.' }
    ],
    tagNames: ['Healthy', 'High-Protein', 'Easy']
  },
  {
    name: 'Chocolate Pancakes',
    description: 'Soft pancakes with cocoa flavor, perfect for dessert or brunch.',
    difficulty: 'Medium',
    cookingTime: 30,
    servings: 3,
    estimatedCost: 75,
    image: 'https://images.unsplash.com/photo-1528207776546-365bb710ee93?auto=format&fit=crop&w=900&q=80',
    ingredients: [
      { name: 'Flour', quantity: 180, unit: 'g' },
      { name: 'Cocoa powder', quantity: 25, unit: 'g' },
      { name: 'Milk', quantity: 220, unit: 'ml' },
      { name: 'Eggs', quantity: 1, unit: 'pcs' }
    ],
    steps: [
      { stepNumber: 1, description: 'Mix the dry ingredients in a bowl.' },
      { stepNumber: 2, description: 'Whisk in milk and egg until smooth.' },
      { stepNumber: 3, description: 'Pour batter onto a hot pan and cook both sides.' },
      { stepNumber: 4, description: 'Serve warm with fruit or syrup.' }
    ],
    tagNames: ['Dessert', 'Sharing']
  }
];

const demoUsers = [
  {
    _id: 'demo-user-account',
    username: 'demo_user',
    email: 'demo@foodshare.local',
    password: 'Demo123!@#',
    role: 'user'
  },
  {
    _id: 'demo-admin-account',
    username: 'demo_admin',
    email: 'admin@foodshare.local',
    password: 'Admin123!@#',
    role: 'admin'
  }
];

async function seedDefaultTags() {
  const defaultTags = [
    'Vegetarian', 'Vegan', 'Gluten-Free', 'Dairy-Free', 'High-Protein',
    'Quick', 'Easy', 'Seafood', 'Meat', 'Dessert', 'Spicy', 'Sharing',
    'FastAndEasy', 'Halal', 'Healthy', 'LowSugar', 'LowFat',
    'HighProtein', 'KidFriendly'
  ];
  for (const tagName of defaultTags) {
    await Tag.findOneAndUpdate(
      { name: tagName },
      { name: tagName },
      { upsert: true, new: true }
    );
  }
  logger.info('Default tags initialized');
}

async function seedDemoUsersIfNeeded() {
  const count = await User.countDocuments();
  if (count > 0) {
    logger.info('Users already exist, skipping demo user seed');
    return;
  }

  logger.info('No users found, seeding demo users');
  for (const user of demoUsers) {
    try {
      const hashedPassword = await bcrypt.hash(user.password, 10);
      await User.create({
        _id: user._id,
        username: user.username,
        email: user.email,
        password: hashedPassword,
        role: user.role
      });
      logger.info(`Seeded demo user: ${user.email}`);
    } catch (err) {
      if (err.code === 11000) {
        logger.info(`Demo user ${user.email} already exists`);
      } else {
        logger.error(`Failed to seed demo user '${user.email}': ${err.message}`);
      }
    }
  }
}

async function seedSampleRecipesIfNeeded() {
  const count = await Recipe.countDocuments();
  if (count > 0) {
    logger.info('Recipes already exist, skipping sample seed');
    return;
  }

  logger.info('No recipes found, seeding sample recipes');
  for (const recipe of sampleRecipes) {
    try {
      const tagIds = [];
      for (const tagName of recipe.tagNames) {
        const tag = await Tag.findOne({ name: tagName });
        if (tag) tagIds.push(tag._id);
      }

      await Recipe.create({
        name: recipe.name,
        description: recipe.description,
        difficulty: recipe.difficulty,
        cookingTime: recipe.cookingTime,
        servings: recipe.servings,
        estimatedCost: recipe.estimatedCost,
        status: 'approved',
        image: recipe.image,
        createdBy: null,
        ingredients: recipe.ingredients,
        steps: recipe.steps,
        tags: tagIds
      });

      logger.info(`Seeded sample recipe: ${recipe.name}`);
    } catch (err) {
      logger.error(`Failed to seed recipe '${recipe.name}': ${err.message}`);
    }
  }
}

// ============ MIDDLEWARE ============
app.use(cors({
  origin: true,
  credentials: true
}));
app.use(bodyParser.json({ limit: REQUEST_BODY_LIMIT }));
app.use(bodyParser.urlencoded({ extended: true, limit: REQUEST_BODY_LIMIT }));

// Request logging middleware
app.use((req, res, next) => {
  logger.info(`${req.method} ${req.path}`);
  next();
});

// ============ IMPORT ROUTES ============
const recipeRoutes = require('./routes/recipes');
const ingredientRoutes = require('./routes/ingredients');
const tagRoutes = require('./routes/tags');
const favoriteRoutes = require('./routes/favorites');
const searchRoutes = require('./routes/search');
const nutritionRoutes = require('./routes/nutrition');
const ratingsRoutes = require('./routes/ratings');
const authRoutes = require('./routes/auth');
const commentsRoutes = require('./routes/comments');
const adminRoutes = require('./routes/admin');

// ============ REGISTER ROUTES ============
app.use('/api/recipes', recipeRoutes);
app.use('/api/ingredients', ingredientRoutes);
app.use('/api/tags', tagRoutes);
app.use('/api/favorites', favoriteRoutes);
app.use('/api/search', searchRoutes);
app.use('/api/nutrition', nutritionRoutes);
app.use('/api/ratings', ratingsRoutes);
app.use('/api/auth', authRoutes);
app.use('/api/comments', commentsRoutes);
app.use('/api/admin', adminRoutes);

app.use(express.static(frontendDir));

app.get('/', (req, res) => {
  res.sendFile(path.join(frontendDir, 'main.html'));
});

// ============ HEALTH CHECK ENDPOINT ============
app.get('/api/health', (req, res) => {
  res.json({ 
    status: 'Server is running',
    environment: NODE_ENV,
    timestamp: new Date().toISOString(),
    uptime: process.uptime()
  });
});

// ============ ERROR HANDLING ============
// 404 handler
app.use((req, res) => {
  if (req.method === 'GET' && !req.path.startsWith('/api/')) {
    return res.sendFile(path.join(frontendDir, 'main.html'));
  }

  res.status(404).json({ 
    error: 'Endpoint not found',
    method: req.method,
    path: req.path
  });
});

// Global error handler
app.use((err, req, res, next) => {
  if (err.type === 'entity.too.large') {
    return res.status(413).json({ error: 'Uploaded image is too large. Please choose a smaller file.' });
  }

  logger.error(`Error: ${err.message}`);
  res.status(err.status || 500).json({ 
    error: err.message || 'Internal server error'
  });
});

// ============ DATABASE CONNECTION & START SERVER ============
const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
  logger.error('MONGODB_URI environment variable is required. Please set it in your .env or Render environment.');
  process.exit(1);
}

mongoose.connect(MONGODB_URI)
  .then(async () => {
    logger.info('Connected to MongoDB Atlas');

    // Seed default data
    await seedDefaultTags();
    await seedDemoUsersIfNeeded();
    await seedSampleRecipesIfNeeded();

    // Start server
    const server = app.listen(PORT, HOST, () => {
      logger.info(`FoodShare Backend running on http://${HOST}:${PORT}`);
      logger.info(`Environment: ${NODE_ENV}`);
      logger.info('Available endpoints:');
      logger.info('  GET /api/health - Check server status');
      logger.info('  POST /api/auth/register - Register user directly');
      logger.info('  POST /api/auth/send-otp - Send OTP to email');
      logger.info('  POST /api/auth/verify-otp - Register user with OTP');
      logger.info('  POST /api/auth/login - Login user');
      logger.info('  GET /api/recipes - Get all recipes');
      logger.info('  POST /api/recipes - Add new recipe');
      logger.info('  GET /api/search - Search recipes');
    });

    // ============ GRACEFUL SHUTDOWN ============
    process.on('SIGTERM', () => {
      logger.warn('SIGTERM signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false).then(() => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    });

    process.on('SIGINT', () => {
      logger.warn('SIGINT signal received: closing HTTP server');
      server.close(() => {
        logger.info('HTTP server closed');
        mongoose.connection.close(false).then(() => {
          logger.info('MongoDB connection closed');
          process.exit(0);
        });
      });
    });
  })
  .catch((err) => {
    logger.error(`MongoDB connection failed: ${err.message}`);
    process.exit(1);
  });

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  logger.error(`Uncaught Exception: ${error.message}`);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  logger.error(`Unhandled Rejection at: ${promise}, reason: ${reason}`);
  process.exit(1);
});

module.exports = { app, logger };
