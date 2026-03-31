const mongoose = require('mongoose');

const ingredientSchema = new mongoose.Schema({
  name: { type: String, required: true },
  quantity: { type: Number, required: true },
  unit: String
});

const stepSchema = new mongoose.Schema({
  stepNumber: Number,
  description: { type: String, required: true }
});

const recipeSchema = new mongoose.Schema({
  name: { type: String, required: true },
  description: String,
  difficulty: { type: String, enum: ['Easy', 'Medium', 'Hard'] },
  cookingTime: Number,
  servings: { type: Number, default: 4 },
  estimatedCost: Number,
  status: { type: String, enum: ['pending', 'approved', 'rejected'], default: 'approved' },
  reviewedBy: String,
  reviewedAt: Date,
  adminFeedback: String,
  image: String,
  createdBy: String,
  ingredients: [ingredientSchema],
  steps: [stepSchema],
  nutrition: {
    calories: Number,
    protein: Number,
    fat: Number,
    carbs: Number,
    fiber: Number
  },
  tags: [{ type: mongoose.Schema.Types.ObjectId, ref: 'Tag' }],
  createdAt: { type: Date, default: Date.now }
});

recipeSchema.set('toJSON', {
  transform: (doc, ret) => {
    ret.id = ret._id;
    delete ret._id;
    delete ret.__v;
  }
});

module.exports = mongoose.model('Recipe', recipeSchema);
