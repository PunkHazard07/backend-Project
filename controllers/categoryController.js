const Product = require('../models/Product');

const VALID_CATEGORIES = ['Living Room', 'Bedroom', 'Dining Room', 'Mirror'];

// Get all categories with product counts + a preview image
exports.getCategoriesWithCounts = async (req, res) => {
    try {
        const categoryData = await Product.aggregate([
            { $sort: { createdAt: -1 } }, // most recent products first, so firstImages reflects the newest product
            {
                $group: {
                    _id: '$category',
                    count: { $sum: 1 },
                    firstImages: { $first: '$images' },
                },
            },
            {
                $project: {
                    _id: 0,
                    name: '$_id',
                    count: 1,
                    image: { $arrayElemAt: ['$firstImages', 0] },
                },
            },
            { $sort: { name: 1 } },
        ]);

        res.status(200).json({ categories: categoryData });
    } catch (error) {
        console.error('Error fetching categories:', error);
        res.status(500).json({
            message: 'Internal server error',
            error: error.message,
        });
    }
};

// Get products by category
exports.getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;

        if (!VALID_CATEGORIES.includes(category)) {
            return res.status(400).json({ message: 'Invalid category' });
        }

        const products = await Product.find({ category });

        res.status(200).json({
            message: products.length === 0 ? 'No products found in this category' : undefined,
            products,
        });
    } catch (error) {
        console.error('Error fetching products by category:', error);
        res.status(500).json({ message: 'Internal server error', error: error.message });
    }
};