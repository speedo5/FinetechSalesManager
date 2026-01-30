/**
 * Migration script to fix the foCode index issue
 * Removes duplicate null foCode values from existing users
 * This script should be run once to clean up the database
 */

const mongoose = require('mongoose');
const dotenv = require('dotenv');
const User = require('../src/models/User');

dotenv.config();

async function fixFoCodeIndex() {
  try {
    // Connect to MongoDB
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');

    // Drop the existing foCode index if it exists
    try {
      await User.collection.dropIndex('foCode_1');
      console.log('Dropped existing foCode index');
    } catch (error) {
      console.log('foCode index does not exist or already dropped');
    }

    // Update all non-field-officer users to not have foCode field
    const result = await User.updateMany(
      { role: { $ne: 'field_officer' } },
      { $unset: { foCode: '' } }
    );
    console.log(`Updated ${result.modifiedCount} users to remove null foCode`);

    // Recreate the index with sparse option (which should already be in the schema)
    await User.collection.createIndex({ foCode: 1 }, { unique: true, sparse: true });
    console.log('Recreated foCode index with sparse option');

    console.log('Migration completed successfully!');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

fixFoCodeIndex();
