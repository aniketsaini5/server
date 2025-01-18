require('dotenv').config();
const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');

// Import validation middleware
const { body, validationResult } = require('express-validator');
const Purchy = require('./model/purchy');  // Import the Purchy schema
const app = express();

// Connect to MongoDB
mongoose.connect(process.env.MONGODB_URI)
    .then(() => console.log("Connected to MongoDB"))
    .catch(err => {
        console.error("MongoDB connection error:", err);
        process.exit(1); // Exit the application if the connection fails
    });

app.use(express.json());
app.use(cors());

// API routes
app.post('/login', (req, res) => {
    const { username, password } = req.body;
    // Check credentials
    if (username === process.env.USERNAME && password === process.env.PASSWORD) {
        return res.json({ success: true });
    } else {
        return res.json({ success: false });
    }
});

// Add a new purchy
app.post('/add-purchy', [
    body('farmer_name').notEmpty().withMessage('Farmer name is required'),
    body('code_no').notEmpty().withMessage('Code number is required').isNumeric().withMessage('Code number must be numeric'),
    body('purchy_no').notEmpty().withMessage('Purchy number is required'),
    body('date').notEmpty().withMessage('Date is required').isISO8601().withMessage('Date must be in YYYY-MM-DD format'),
    body('weight').notEmpty().withMessage('Weight is required').isFloat({ gt: 0 }).withMessage('Weight must be a positive number'),
    body('price').notEmpty().withMessage('Price is required').isFloat({ gt: 0 }).withMessage('Price must be a positive number'),
    body('transport_status').notEmpty().withMessage('Transport status is required'),
    body('transporter_name').notEmpty().withMessage('Transporter name is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }

    try {
        const purchy = new Purchy(req.body);
        await purchy.save();
        res.status(201).json({ message: 'Purchy added successfully', purchy });
    } catch (error) {
        console.error('Error adding purchy:', error);
        if (error.code === 11000) {
            return res.status(400).json({ error: 'Purchy number must be unique' });
        }
        res.status(500).json({ error: 'Failed to add purchy', details: error.message });
    }
});

// Search purchies by farmer name or code number
app.post('/search', async (req, res) => {
    try {
        const { session, codeNo, transportStatus, price, weight } = req.body;
        let query = {};
        
        // Build query with case-insensitive matching for string fields
        if (session) query.Session = session; // Match the exact field name from MongoDB
        if (codeNo) query.code_no = codeNo;
        if (transportStatus && transportStatus !== 'all') {
            query.transport_status = transportStatus;
        }
        
        // Handle price filter
        if (price && price.value) {
            const priceValue = parseFloat(price.value);
            if (!isNaN(priceValue)) {
                query.price = price.comparison === 'greater' 
                    ? { $gte: priceValue } 
                    : { $lte: priceValue };
            }
        }
        
        // Handle weight filter
        if (weight && weight.value) {
            const weightValue = parseFloat(weight.value);
            if (!isNaN(weightValue)) {
                query.weight = weight.comparison === 'greater' 
                    ? { $gte: weightValue } 
                    : { $lte: weightValue };
            }
        }
        
        // console.log('Query:', query); // For debugging
        
        const results = await Purchy.find(query)
            .collation({ locale: 'en', strength: 2 }); // Case-insensitive search
            
       // console.log('Results:', results); // For debugging
        
        res.json(results);
    } catch (error) {
        console.error('Error in search:', error);
        res.status(500).json({ 
            message: 'Internal Server Error',
            error: error.message 
        });
    }
});



// Add this new endpoint for searching a single purchy
app.get('/search-purchy', async (req, res) => {
    try {
        const { code_no, purchy_no } = req.query;
        
        if (!code_no || !purchy_no) {
            return res.status(400).json({ 
                success: false, 
                message: 'Both code number and purchy number are required' 
            });
        }

        const purchy = await Purchy.findOne({ code_no, purchy_no });
        
        if (!purchy) {
            return res.json({ 
                success: false, 
                message: 'Purchy not found' 
            });
        }

        return res.json({ 
            success: true, 
            purchy 
        });

    } catch (error) {
        console.error('Error searching purchy:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Internal server error',
            error: error.message 
        });
    }
});


// Update purchy
app.put('/update-purchy', [
    body('code_no').notEmpty().withMessage('Code number is required'),
    body('purchy_no').notEmpty().withMessage('Purchy number is required'),
], async (req, res) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    const { code_no, purchy_no, ...updateData } = req.body;
    try {
        const updatedPurchy = await Purchy.findOneAndUpdate(
            { code_no, purchy_no },
            updateData,
            { new: true } // Return the updated document
        );
        if (!updatedPurchy) {
            return res.status(404).json({ success: false, message: 'Purchy not found' });
        }
        res.json({ success: true, message: 'Purchy updated successfully!', updatedPurchy });
    } catch (error) {
        console.error(error);
        res.status(500).json({ message: 'Failed to update purchy' });
    }
});

// transport statues 
app.post('/update-transport-status', async (req, res) => {
    try {
        const { purchy_no, transport_status } = req.body;
        
        // Validate input
        if (!purchy_no || !transport_status) {
            return res.status(400).json({
                success: false,
                message: 'Purchy number and transport status are required'
            });
        }

        // Validate transport status value
        if (!['paid', 'unpaid'].includes(transport_status.toLowerCase())) {
            return res.status(400).json({
                success: false,
                message: 'Invalid transport status. Must be either "paid" or "unpaid"'
            });
        }

        // Find and update the purchy
        const updatedPurchy = await Purchy.findOneAndUpdate(
            { purchy_no },
            { transport_status: transport_status.toLowerCase() },
            { new: true } // Return the updated document
        );

        if (!updatedPurchy) {
            return res.status(404).json({
                success: false,
                message: 'Purchy not found'
            });
        }

        return res.json({
            success: true,
            message: 'Transport status updated successfully',
            purchy: updatedPurchy
        });

    } catch (error) {
        console.error('Error updating transport status:', error);
        res.status(500).json({
            success: false,
            message: 'Internal server error',
            error: error.message
        });
    }
});

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).send('Something broke!');
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));

