const mongoose = require('mongoose');

const purchySchema = new mongoose.Schema({
    Session: {
        type: String,
        required: true
    },
    farmer_name: {
        type: String,
        required: true
    },
    code_no: {
        type: String,
        required: true
    },
    purchy_no: {
        type: String, required: true,
        unique: true
    },
    date: {
        type: Date,
        required: true
    },
    weight: {
        type: Number,
        required: true,
        default: 50.00
    },
    price: {
        type: Number,
        required: true
    },
    transport_status: {
        type: String,
        enum: ['Paid', 'Unpaid'],
        required: true
    },
    transporter_name: {
        type: String,
        required: true,
        default: 'Suniel Saini'
    }
}, { timestamps: true });

module.exports = mongoose.model('Purchy', purchySchema);

