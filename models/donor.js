const mongoose = require('mongoose');

const donorSchema = new mongoose.Schema({
    name: {
        type:String,
        required:true
    },

    address: {
        type:String,
        required:true
    },

    bloodGroup: {
        type:String,
        required:true
    },

    phone: {
        type:String,
        required:true
    },

    email: {
        type:String,
        required:true,
        unique:true
    },

    weight: {
        type:Number,
        required:true,
        min:45
    },

    age: {
        type:Number,
        required:true,
        min:18,
        max:65

    },

    diseases: {
        type:String,
        default: 'None'
    },

    status:{
    type: String,
    enum:['fit' , 'unfit'],
    required:false
    }, 

    registrationDate: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Donor',donorSchema);