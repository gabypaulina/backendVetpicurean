const mongoose = require('mongoose')

const PetBioSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    require: true
  },
  petType: { 
    type: [String], 
    required: true
  },
  gender: { 
    type: String, 
    required: true
  },
  numberOfPets: { 
    type: String, 
    required: true
  },
  age: { 
    type: String, 
    required: true
  },
  expense: { 
    type: String, 
    required: true
  },
  petDescription : {
    type : String,
    required: true
  }
});

module.exports = mongoose.model('PetBio', PetBioSchema);