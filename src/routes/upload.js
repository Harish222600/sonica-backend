const express = require('express');
const router = express.Router();
const multer = require('multer');
const { protect } = require('../middleware/auth');
const fileService = require('../services/fileService');
const User = require('../models/User');

// Configure multer for memory storage
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024 // 5MB limit
    },
    fileFilter: (req, file, cb) => {
        if (file.mimetype.startsWith('image/')) {
            cb(null, true);
        } else {
            cb(new Error('Not an image! Please upload only images.'), false);
        }
    }
});

// @route   POST /api/upload/avatar
// @desc    Upload user avatar
// @access  Private
router.post('/avatar', protect, upload.single('avatar'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Please upload a file'
            });
        }

        const userId = req.user._id.toString();
        const file = req.file;

        // Upload to Supabase
        const { url } = await fileService.uploadAvatar(
            file.buffer,
            userId,
            file.mimetype
        );

        // Update user profile with new avatar URL
        const user = await User.findByIdAndUpdate(
            userId,
            { avatar: url },
            { new: true }
        );

        res.json({
            success: true,
            data: {
                avatar: url,
                user
            }
        });
    } catch (error) {
        console.error('Avatar upload error:', error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
});

module.exports = router;
