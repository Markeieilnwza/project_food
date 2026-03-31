const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const db = new sqlite3.Database(path.join(__dirname, 'recipes.db'));

function insertSampleData() {
  db.serialize(() => {
    // Sample recipes
    const recipes = [
      {
        name: 'Pad Thai',
        description: 'Popular Thai stir-fried noodles (4 servings)',
        difficulty: 'Easy',
        cookingTime: 20,
        servings: 4,
        image: 'https://images.unsplash.com/photo-1596286272554-f62dc9e7f1a0?w=400'
      },
      {
        name: 'Margherita Pizza',
        description: 'Classic Italian pizza with fresh basil and mozzarella (2 servings)',
        difficulty: 'Medium',
        cookingTime: 30,
        servings: 2,
        image: 'https://images.unsplash.com/photo-1604068549290-dea0e4a305ca?w=400'
      },
      {
        name: 'Grilled Salmon with Lemon',
        description: 'Healthy grilled salmon fillet (1 serving)',
        difficulty: 'Easy',
        cookingTime: 15,
        servings: 1,
        image: 'https://images.unsplash.com/photo-1580959375944-abd7e991f971?w=400'
      },
      {
        name: 'Beef Tacos',
        description: 'Mexican-style tacos with minced beef (4 servings)',
        difficulty: 'Easy',
        cookingTime: 25,
        servings: 4,
        image: 'https://images.unsplash.com/photo-1565299585323-38d6b0865b47?w=400'
      },
      {
        name: 'Mushroom Risotto',
        description: 'Creamy Italian rice with mushrooms (3 servings)',
        difficulty: 'Medium',
        cookingTime: 35,
        servings: 3,
        image: 'https://images.unsplash.com/photo-1509042239860-f550ce710b93?w=400'
      }
    ];

    let recipeIds = [];

    // Insert recipes
    recipes.forEach((recipe, index) => {
      db.run(
        `INSERT INTO recipes (name, description, difficulty, cookingTime, servings, image)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [recipe.name, recipe.description, recipe.difficulty, recipe.cookingTime, recipe.servings, recipe.image],
        function(err) {
          if (err) {
            console.error('Error inserting recipe:', err);
          } else {
            recipeIds[index] = this.lastID;
            console.log(`Inserted recipe: ${recipe.name} (ID: ${this.lastID})`);
          }
        }
      );
    });

    // Insert ingredients for Pad Thai
    setTimeout(() => {
      const ingredients = [
        { recipeId: recipeIds[0], name: 'Rice noodles', quantity: 300, unit: 'g' },
        { recipeId: recipeIds[0], name: 'Shrimp', quantity: 300, unit: 'g' },
        { recipeId: recipeIds[0], name: 'Tamarind paste', quantity: 3, unit: 'tbsp' },
        { recipeId: recipeIds[0], name: 'Fish sauce', quantity: 2, unit: 'tbsp' },
        { recipeId: recipeIds[0], name: 'Eggs', quantity: 2, unit: 'pcs' },
        { recipeId: recipeIds[0], name: 'Peanuts', quantity: 50, unit: 'g' },
        { recipeId: recipeIds[0], name: 'Green onions', quantity: 2, unit: 'stalks' }
      ];

      ingredients.forEach(ing => {
        db.run(
          'INSERT INTO ingredients (recipeId, name, quantity, unit) VALUES (?, ?, ?, ?)',
          [ing.recipeId, ing.name, ing.quantity, ing.unit],
          () => console.log(`Added ingredient: ${ing.name} to Pad Thai`)
        );
      });
    }, 1000);

    // Insert nutrition data
    setTimeout(() => {
      const nutritionData = [
        { recipeId: recipeIds[0], calories: 350, protein: 25, fat: 8, carbs: 45, fiber: 2 },
        { recipeId: recipeIds[1], calories: 280, protein: 12, fat: 10, carbs: 38, fiber: 2 },
        { recipeId: recipeIds[2], calories: 290, protein: 35, fat: 18, carbs: 5, fiber: 1 },
        { recipeId: recipeIds[3], calories: 320, protein: 28, fat: 14, carbs: 24, fiber: 3 },
        { recipeId: recipeIds[4], calories: 310, protein: 10, fat: 12, carbs: 42, fiber: 2 }
      ];

      nutritionData.forEach(nut => {
        db.run(
          'INSERT INTO nutrition (recipeId, calories, protein, fat, carbs, fiber) VALUES (?, ?, ?, ?, ?, ?)',
          [nut.recipeId, nut.calories, nut.protein, nut.fat, nut.carbs, nut.fiber],
          () => console.log(`Added nutrition info for recipe ID: ${nut.recipeId}`)
        );
      });
    }, 1000);

    // Insert tags
    setTimeout(() => {
      const tagNames = ['Easy', 'Quick', 'Vegan', 'Gluten-Free', 'High-Protein', 'Seafood', 'Thai', 'Italian'];
      tagNames.forEach(tagName => {
        db.run(
          'INSERT OR IGNORE INTO tags (name) VALUES (?)',
          [tagName],
          () => console.log(`Added tag: ${tagName}`)
        );
      });

      // Add tags to recipes
      setTimeout(() => {
        const recipeTags = [
          { recipeId: recipeIds[0], tags: ['Easy', 'Quick', 'Thai', 'Seafood'] },
          { recipeId: recipeIds[1], tags: ['Italian', 'Vegetarian'] },
          { recipeId: recipeIds[2], tags: ['Easy', 'Quick', 'High-Protein', 'Gluten-Free', 'Seafood'] },
          { recipeId: recipeIds[3], tags: ['Easy', 'Gluten-Free'] },
          { recipeId: recipeIds[4], tags: ['Italian'] }
        ];

        recipeTags.forEach(rt => {
          rt.tags.forEach(tagName => {
            db.run(
              'INSERT OR IGNORE INTO recipe_tags (recipeId, tagId) SELECT ?, id FROM tags WHERE name = ?',
              [rt.recipeId, tagName]
            );
          });
        });
      }, 500);
    }, 1000);

    console.log('Sample data insertion started...');
  });

  setTimeout(() => {
    db.close();
    console.log('Database connection closed');
  }, 5000);
}

// Run the function
insertSampleData();
