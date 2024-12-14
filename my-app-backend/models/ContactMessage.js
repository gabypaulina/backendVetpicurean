const mongoose = require('mongoose')

const ContactMessageSchema = new mongoose.Schema({
  nama: { 
    type: String, 
    required: true
  },
  email: { 
    type: String, 
    required: true
  },
  subject: { 
    type: String, 
    required: true
  },
  request: { 
    type: String, 
    required: true
  },
  createdAt: { 
    type: Date, 
    default: Date.now
  }
});

module.exports = mongoose.model('ContactMessage', ContactMessageSchema);