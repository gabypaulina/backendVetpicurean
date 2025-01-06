const express = require('express');
const mongoose = require('mongoose');
const bodyParser = require('body-parser');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const cors = require('cors')
const nodemailer = require('nodemailer')
const sgMail = require('@sendgrid/mail')
const multer = require('multer')
const path = require('path')
const fs = require('fs')
const ExcelJS = require('exceljs')
require('dotenv').config()

const User = require('./models/User');
const Pet = require('./models/PetBio');
const ContactMessage = require('./models/ContactMessage')
const Article = require('./models/Article')

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, 'uploads/')
  },
  filename: (req, file, cb) => {
    cb(null, Date.now() + path.extname(file.originalname))
  }
})

const upload = multer({storage})

const adminCredentials = {
  email: 'admin',
  password: 'admin'
}

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
  try {
    if (!fullName || !email || !password || !confirmPassword) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    if (password !== confirmPassword) {
      return res.status(400).json({ message: 'Passwords do not match' });
    }
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
  console.log(`Login attempt with email: ${email} and password: ${password}`);  

  try {
    if (email === adminCredentials.email && password === adminCredentials.email) {
      const adminToken = jwt.sign({ role: "admin" }, 'jwtSecret', { expiresIn: '1h' });
      return res.status(200).json({ token: adminToken, fullName: "ADMIN", role: "admin"});
    }

    const user = await User.findOne({ email });
    
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' })
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ message: 'Password Incorrect'})
    }


    const token = jwt.sign({ id: user._id }, 'jwtSecret', { expiresIn: '1h'});

    res.status(200).json({ token, fullName: user.fullName, role: "user" })
  }catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
})

// Pet Biodata
app.post('/api/petbio', async (req, res) => {
  console.log('Request body:', req.body)
  const { userId, petType, gender, numberOfPets, age, expense, petDescription } = req.body;

  try {
    if (!userId || !petType || !gender || !numberOfPets || !age || !expense || !petDescription) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const petBio = new Pet({ userId, petType, gender, numberOfPets, age, expense, petDescription });
    await petBio.save();

    res.status(201).json({ message: 'Pet biodata saved successfully' });
  } catch (err) {
    console.error('Error during saving pet biodata:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

//Subscribe
app.post('/send-email', (req,res) => {
  const {toEmail, fromEmail, subject, text} = req.body;

  const msg = {
    to: toEmail,
    from: fromEmail,
    subject: subject,
    text: text
  }

  sg.Mail.send(msg)
  .then(() => {
    res.status(200).send('Email sent')
  })
  .catch(error => {
    res.status(500).send(error.toString())
  })
})

app.get('/api/users/:userId', async (req, res) => {
  const { userId } = req.params;
  try {
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.status(200).json({ email: user.email });
  } catch (err) {
    console.error('Error fetching user:', err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add Artikel
app.post('/api/articles', upload.single('file'), async (req, res) => {
  try {
    const { title, description } = req.body;
    
    if (!title || !description) {
      return res.status(400).json({ message: 'Title and description are required' });
    }

    const file = req.file;
    
    const newArticle = new Article({
      title,
      description,
      imageUrl: file ? file.path : '',
      createdAt: new Date()
    });

    const savedArticle = await newArticle.save();
    console.log('Saved article:', savedArticle); // Add logging
    
    res.status(201).json({ message: 'Article saved successfully', article: savedArticle });
  } catch (err) {
    console.error('Error saving article:', err);
    res.status(500).json({ message: 'Server error', error: err.toString() });
  }
});

// Get all articles
app.get('/api/articles', async (req, res) => {
  try {
    const articles = await Article.find()
      .sort({ createdAt: -1 }); // Sort by newest first
    res.status(200).json(articles);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get single article by ID
app.get('/api/articles/:id', async (req, res) => {
  try {
    const article = await Article.findById(req.params.id);
    if (!article) {
      return res.status(404).json({ message: 'Article not found' });
    }
    res.status(200).json(article);
  } catch (err) {
    console.error('Error fetching article:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get articles with pagination and optional search
app.get('/api/articles/page/:page', async (req, res) => {
  try {
    const { page = 1, limit = 10, search } = req.query;
    const skip = (page - 1) * limit;

    let query = {};
    if (search) {
      query = {
        $or: [
          { title: { $regex: search, $options: 'i' } },
          { description: { $regex: search, $options: 'i' } }
        ]
      };
    }

    const articles = await Article.find(query)
      .sort({ createdAt: -1 })
      .skip(skip)
      .limit(parseInt(limit));

    const total = await Article.countDocuments(query);

    res.status(200).json({
      articles,
      currentPage: parseInt(page),
      totalPages: Math.ceil(total / limit),
      totalArticles: total
    });
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

// Get articles by date range
app.get('/api/articles/date-range', async (req, res) => {
  try {
    const { startDate, endDate } = req.query;

    if (!startDate || !endDate) {
      return res.status(400).json({ message: 'Start date and end date are required' });
    }

    const articles = await Article.find({
      createdAt: {
        $gte: new Date(startDate),
        $lte: new Date(endDate)
      }
    }).sort({ createdAt: -1 });

    res.status(200).json(articles);
  } catch (err) {
    console.error('Error fetching articles:', err);
    res.status(500).json({ message: 'Server error', error: err.message });
  }
});

app.get('/download-excel', (req,res) => {
  const exportFolder = path.join(__dirname, 'exports');
  const fileName = 'User_Pet_Data.xlsx'
  const filePath = path.join(exportFolder, fileName)

  if(fs.existsSync(filePath)){
    res.download(filePath, (err) => {
      if (err){
        console.error('Error downloading file: ', err);
        res.status(500).send('Error downloading file')
      }
    })
  }else{
    res.status(404).send('File not found')
  }
  
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});