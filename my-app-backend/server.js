const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors')

const User = require('./models/User');
const Pet = require('./models/PetBio');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

mongoose.connect('mongodb://127.0.0.1:27017/vetapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

// Register
app.post('/api/register', async (req, res) => {
  const { fullName, email, password, confirmPassword } = req.body;
  console.log("Request body: ", req.body)

  if (!fullName || !email || !password || !confirmPassword) {
    return res.status(400).json({ message: 'All fields are required' });
  }

  if (password !== confirmPassword) {
    return res.status(400).json({ message: 'Passwords do not match' });
  }

  try {
    const userExists = await User.findOne({ email });
    if (userExists) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    console.log('Request body:', req.body);

    const hashedPassword = await bcrypt.hash(password, salt);

    const user = new User({ fullName, email, password: hashedPassword });
    await user.save();

    res.status(201).json({ message: 'User registered successfully', userId: user.id });
  } catch (err) {
    console.error('Error during registration: ', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Login
app.post('/api/login', async (req, res) => {
  const { email, password } = req.body;

  try {
    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password Incorrect'})
    }

    const token = jwt.sign({ id: user._id }, 'jwtSecret', { expiresIn: '1h'});

    res.json({ token })
  }catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
})

// Pet Biodata
app.post('/api/petbio', async (req, res) => {
  console.log('Request body:', req.body)
  const { userId, petType, gender, numberOfPets, age, expense } = req.body;

  try {
    if (!userId || !petType || !gender || !numberOfPets || !age || !expense) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const petBio = new Pet({ userId, petType, gender, numberOfPets, age, expense });
    await petBio.save();

    res.status(201).json({ message: 'Pet biodata saved successfully' });
  } catch (err) {
    console.error('Error during saving pet biodata:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});