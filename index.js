const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const app = express();
const PORT = 3000;

app.use(bodyParser.json());

// Connect to MongoDB
mongoose.connect('mongodb://localhost:27017/moneyLendingApp', {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

// User schema and model
const userSchema = new mongoose.Schema({
  phone: String,
  email: String,
  name: String,
  registrationDate: { type: Date, default: Date.now },
  dob: Date,
  monthlySalary: Number,
  status: String,
  password: String,
  purchasePower: { type: Number, default: 0 },
});

const User = mongoose.model('User', userSchema);

// Middleware to authenticate JWT
const authenticateJWT = (req, res, next) => {
  const token = req.header('Authorization')?.replace('Bearer ', '');
  if (!token) {
    return res.status(401).json({ message: 'Access Denied' });
  }
  try {
    const verified = jwt.verify(token, 'secretKey');
    req.user = verified;
    next();
  } catch (error) {
    res.status(400).json({ message: 'Invalid Token' });
  }
};

// Approve Application During Signup
app.post('/signup', async (req, res) => {
  const { phone, email, name, dob, monthlySalary, password } = req.body;
  const age = new Date().getFullYear() - new Date(dob).getFullYear();

  if (age < 20 || monthlySalary < 25000) {
    return res.status(400).json({ message: 'Application rejected' });
  }

  const hashedPassword = await bcrypt.hash(password, 10);

  const newUser = new User({
    phone,
    email,
    name,
    dob: new Date(dob),
    monthlySalary,
    status: 'approved',
    password: hashedPassword,
    purchasePower: monthlySalary * 2, // Assuming purchase power is twice the monthly salary
  });

  await newUser.save();
  res.status(201).json({ message: 'Application approved', user: newUser });
});

// Login API
app.post('/login', async (req, res) => {
  const { email, password } = req.body;
  const user = await User.findOne({ email });

  if (!user || !bcrypt.compareSync(password, user.password)) {
    return res.status(401).json({ message: 'Invalid credentials' });
  }

  const token = jwt.sign({ id: user._id }, 'secretKey', { expiresIn: '1h' });
  res.json({ token });
});

// Show User Data
app.get('/user', authenticateJWT, async (req, res) => {
  const user = await User.findById(req.user.id).select('-password');
  res.json(user);
});

// Borrow Money API
app.post('/borrow', authenticateJWT, async (req, res) => {
  const { amount, tenure } = req.body;
  const user = await User.findById(req.user.id);

  if (amount > user.purchasePower) {
    return res.status(400).json({ message: 'Insufficient purchase power' });
  }

  const interestRate = 0.08;
  const monthlyRepayment = (amount * (1 + interestRate)) / tenure;

  user.purchasePower -= amount;
  await user.save();

  res.json({ purchasePower: user.purchasePower, monthlyRepayment });
});

app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
