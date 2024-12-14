const mongoose = require('mongoose')
const XLSX = require('xlsx')
const fs = require('fs')

mongoose.connect('mongodb://127.0.0.1:27017/vetapp', {
  useNewUrlParser: true,
  useUnifiedTopology: true
})
.then(() => console.log('MongoDB connected'))
.catch(err => console.error('MongoDB connection error:', err));

const User = mongoose.model('User', new mongoose.Schema({
  fullName: String,
  email: String,
  password: String,
}));

const exportDataToExcel = async () => {
  try{
    const users = await User.find({})

    const dataToExport = users.map(user => ({
      fullName: user.fullName,
      email: user.email,
      password: user.password
    }))

    const worksheet = XLSX.utils.json_to_sheet(dataToExport)

    const workbook = XLSX.utils.book_new()
    XLSX.utils.book_append_sheet(workbook, worksheet, 'UserData')

    XLSX.writeFile(workbook, 'user_data.xlsx')
    console.log('Data berhasil dieksport ke Excel')
  }catch(error){
    console.error('Error saat meneksport data ke Excel: ', error)
  }finally {
    mongoose.connection.close()
  }
}

exportDataToExcel()