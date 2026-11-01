// Explicitly scoped maintenance tool; never bulk-delete accounts.
require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./src/models/User');
const Prediction = require('./src/models/Prediction');
(async () => {
  const email = process.argv[2]?.trim().toLowerCase();
  if (!email || process.argv[3] !== '--confirm') {
    throw new Error('Usage: node delete_user.js <email> --confirm');
  }
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    const user = await User.findOne({ email });
    if (!user) throw new Error('User not found');
    await Prediction.deleteMany({ userId: user._id });
    await User.deleteOne({ _id: user._id });
    console.log('Selected account and predictions deleted.');
  } finally {
    await mongoose.disconnect();
  }
})().catch(error => { console.error(error.message); process.exitCode = 1; });
