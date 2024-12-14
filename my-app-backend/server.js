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

const exportDataToExcel = async (user, petBio) => {
  const workbook = new ExcelJS.Workbook()
  const worksheet = workbook.addWorksheet('User Data')
  
  worksheet.columns = [
    {header: 'Full Name', key: 'fullName', width: 30},
    {header: 'Email', key: 'email', width: 30},
    {header: 'Pet Type', key: 'petType', width: 30},
    {header: 'Gender', key: 'gender', width: 30},
    {header: 'Number of Pets', key: 'numberOfPets', width: 30},
    {header: 'Age', key: 'age', width: 30},
    {header: 'Expense', key: 'expense', width: 30},
    {header: 'Pet Description', key: 'petDescription', width: 30},

  ]
  
  worksheet.addRow({
    fullName: user.fullName,
    email: user.email,
    petType: Pet.petType.join(','),
    gender: Pet.gender,
    numberOfPets: Pet.numberOfPets,
    age: Pet.age,
    expense: Pet.expense,
    petDescription: Pet.petDescription
  })

  await workbook.xlsx.writeFile(`./exports/User_DAta${user.email}.xlsx`)
}

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

    const petBio = new Pet({
      userId: user._id,
      petType,
      gender,
      numberOfPets,
      age,
      expense,
      petDescription,
    });
    await petBio.save();

    await exportDataToExcel(user, petBio)


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
app.post('/api/articles', upload.single('file'), async (req,res) => {
  const { title, description } = req.body;
  const file = req.file;
  
  const newArticle = new Article({
    title,
    description,
    imageUrl: file ? file.path : '',
    createdAt: new Date()
  })
  try {    
    await newArticle.save()
    res.status(201).json({message: 'Article saved successfully'})
  }catch(err){
    console.error('Error saving article: ', err);
    res.status(500).json({ message: 'Server error', error: err.message})
  }
})

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`)
});