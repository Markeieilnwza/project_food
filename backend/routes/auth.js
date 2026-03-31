const express = require('express');
const router = express.Router();
const nodemailer = require('nodemailer');
const crypto = require('crypto');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const validator = require('validator');
const User = require('../models/User');
const Recipe = require('../models/Recipe');

// Store OTP temporarily (in production, use Redis or database)
const otpStore = {};

// Configure email service - Gmail SMTP
let transporter;

function initializeEmailService() {
  try {
    const emailHost = process.env.EMAIL_HOST || 'smtp.gmail.com';
    const emailPort = parseInt(process.env.EMAIL_PORT || '587');
    const emailUser = process.env.EMAIL_USER;
    const emailPass = process.env.EMAIL_PASS;

    if (!emailUser || !emailPass) {
      console.error('โ Email configuration incomplete. Set EMAIL_USER and EMAIL_PASS in .env');
      return;
    }

    transporter = nodemailer.createTransport({
      host: emailHost,
      port: emailPort,
      secure: emailPort === 465,
      auth: {
        user: emailUser,
        pass: emailPass
      }
    });

    console.log('โ… Email service ready (Gmail SMTP)');
    console.log(`๐“ง Sending from: ${emailUser}`);
  } catch (error) {
    console.error('โ Email service error:', error.message);
  }
}

initializeEmailService();

function generateOTP() {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Send OTP to email
router.post('/send-otp', (req, res) => {
  try {
    const { email, username } = req.body;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    const otp = generateOTP();
    const expiryTime = Date.now() + 10 * 60 * 1000;

    otpStore[email] = { otp, expiryTime, username };

    const mailOptions = {
      from: process.env.EMAIL_FROM || 'noreply@foodshare.com',
      to: email,
      subject: 'FoodShare - Email Verification Code',
      html: `
        <h2>Welcome to FoodShare!</h2>
        <p>Your OTP verification code is:</p>
        <h1 style="color: #d97706; font-size: 32px; letter-spacing: 5px;">${otp}</h1>
        <p>This code will expire in 10 minutes.</p>
        <p>If you didn't request this, please ignore this email.</p>
        <hr>
        <p>FoodShare Team</p>
      `
    };

    transporter.sendMail(mailOptions, (error, info) => {
      if (error) {
        console.log('โ Email error:', error.message);
        return res.status(500).json({ error: 'Failed to send OTP. ' + error.message });
      }
      
      console.log('โ… OTP sent to:', email);
      res.json({ 
        success: true, 
        message: 'OTP sent to your email. Check your inbox.'
      });
    });
  } catch (error) {
    console.error('Send OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify OTP and Register User
router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp, password, username } = req.body;

    if (!email || !otp || !password || !username) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    if (!otpStore[email]) {
      return res.status(400).json({ error: 'OTP not sent or expired. Send OTP first.' });
    }

    const { otp: storedOtp, expiryTime } = otpStore[email];

    if (Date.now() > expiryTime) {
      delete otpStore[email];
      return res.status(400).json({ error: 'OTP expired. Send new OTP.' });
    }

    if (otp !== storedOtp) {
      return res.status(400).json({ error: 'Invalid OTP' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomBytes(16).toString('hex');

    try {
      await User.create({
        _id: userId,
        username,
        email,
        password: hashedPassword
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: 'Email or username already exists' });
      }
      throw err;
    }

    const token = jwt.sign(
      { userId, username, email },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '7d' }
    );

    delete otpStore[email];

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId,
      username,
      email,
      role: 'user',
      token
    });
  } catch (error) {
    console.error('Verify OTP error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/register', async (req, res) => {
  try {
    const { email, password, username } = req.body;

    if (!email || !password || !username) {
      return res.status(400).json({ error: 'All fields required' });
    }

    if (!validator.isEmail(email)) {
      return res.status(400).json({ error: 'Invalid email format' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    if (username.length < 3) {
      return res.status(400).json({ error: 'Username must be at least 3 characters' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = crypto.randomBytes(16).toString('hex');

    try {
      await User.create({
        _id: userId,
        username,
        email,
        password: hashedPassword
      });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(400).json({ error: 'Email or username already exists' });
      }
      throw err;
    }

    const token = jwt.sign(
      { userId, username, email },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '7d' }
    );

    res.status(201).json({
      success: true,
      message: 'Registration successful',
      userId,
      username,
      email,
      role: 'user',
      token
    });
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password required' });
    }

    const user = await User.findOne({ email }).select('_id username email password role');

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      return res.status(401).json({ error: 'Invalid email or password' });
    }

    const token = jwt.sign(
      { userId: user._id, username: user.username, email: user.email },
      process.env.JWT_SECRET || 'your-secret-key-here',
      { expiresIn: '7d' }
    );

    res.json({
      success: true,
      message: 'Login successful',
      userId: user._id,
      username: user.username,
      email: user.email,
      role: user.role,
      token
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user profile
router.get('/profile/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('username email createdAt');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: user._id, username: user.username, email: user.email, createdAt: user.createdAt });
  } catch (error) {
    console.error('Profile error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Verify JWT token middleware
function verifyToken(req, res, next) {
  const token = req.headers.authorization?.split(' ')[1];

  if (!token) {
    return res.status(401).json({ error: 'Token required' });
  }

  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key-here');
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

async function verifyAdmin(req, res, next) {
  try {
    const user = await User.findById(req.user.userId);

    if (!user || user.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    next();
  } catch (err) {
    return res.status(500).json({ error: 'Server error' });
  }
}

// Protected route: Get current user
router.get('/me', verifyToken, (req, res) => {
  res.json({ success: true, user: req.user });
});

// Check if any admin exists
router.get('/check-admin-exists', async (req, res) => {
  try {
    const admin = await User.findOne({ role: 'admin' }).select('_id').lean();
    res.json({ exists: !!admin });
  } catch (error) {
    console.error('Admin check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/admin/users', verifyToken, async (req, res) => {
  try {
    // Check admin
    const requestingUser = await User.findById(req.user.userId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    const users = await User.find().select('username email role createdAt').lean();

    // Get recipe counts for each user
    for (const user of users) {
      const recipeCount = await Recipe.countDocuments({ createdBy: user._id });
      const pendingRecipeCount = await Recipe.countDocuments({ createdBy: user._id, status: 'pending' });
      user.id = user._id;
      delete user._id;
      delete user.__v;
      user.recipeCount = recipeCount;
      user.pendingRecipeCount = pendingRecipeCount;
    }

    // Sort: admins first, then by createdAt desc
    users.sort((a, b) => {
      if (a.role === 'admin' && b.role !== 'admin') return -1;
      if (a.role !== 'admin' && b.role === 'admin') return 1;
      return new Date(b.createdAt) - new Date(a.createdAt);
    });

    res.json(users);
  } catch (error) {
    console.error('Admin users list error:', error);
    res.status(500).json({ error: 'Failed to load users' });
  }
});

router.put('/admin/users/:userId/role', verifyToken, async (req, res) => {
  try {
    const { userId } = req.params;
    const { role } = req.body;

    // Check admin
    const requestingUser = await User.findById(req.user.userId);
    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ error: 'Admin access required' });
    }

    if (!['user', 'admin'].includes(role)) {
      return res.status(400).json({ error: 'Role must be user or admin' });
    }

    if (req.user.userId === userId && role !== 'admin') {
      return res.status(400).json({ error: 'You cannot remove your own admin access' });
    }

    const result = await User.findByIdAndUpdate(userId, { role });

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ success: true, message: 'User role updated successfully' });
  } catch (error) {
    console.error('Admin role update error:', error);
    res.status(500).json({ error: 'Failed to update user role' });
  }
});

// SECURE: Admin Management
router.post('/set-admin', verifyToken, async (req, res) => {
  try {
    const { email } = req.body;
    const requestingUserId = req.user.userId;

    if (!email) {
      return res.status(400).json({ error: 'Email required' });
    }

    const requestingUser = await User.findById(requestingUserId);

    if (!requestingUser || requestingUser.role !== 'admin') {
      return res.status(403).json({ 
        error: 'Access denied. Only admins can grant admin status.' 
      });
    }

    const result = await User.findOneAndUpdate({ email }, { role: 'admin' });

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: `User ${email} is now an admin` 
    });
  } catch (error) {
    console.error('Admin update error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// Get user role
router.get('/user-role/:userId', async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).select('username email role');

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ id: user._id, username: user.username, email: user.email, role: user.role });
  } catch (error) {
    console.error('Role check error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

// SECURE SETUP: Make first user admin
router.post('/setup-first-admin', async (req, res) => {
  try {
    const { userId, adminCode } = req.body;

    if (!userId || !adminCode) {
      return res.status(400).json({ error: 'User ID and admin code required' });
    }

    const ADMIN_SETUP_CODE = process.env.ADMIN_SETUP_CODE || 'CHANGE_ME_2026';

    if (adminCode !== ADMIN_SETUP_CODE) {
      return res.status(403).json({ error: 'Invalid admin code' });
    }

    const existingAdmin = await User.findOne({ role: 'admin' }).lean();

    if (existingAdmin) {
      return res.status(403).json({ 
        error: 'An admin already exists. Only existing admins can grant admin status.' 
      });
    }

    const result = await User.findByIdAndUpdate(userId, { role: 'admin' });

    if (!result) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json({ 
      success: true, 
      message: 'You are now the admin of this system' 
    });
  } catch (error) {
    console.error('Setup error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;

