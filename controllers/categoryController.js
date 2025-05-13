const Product = require('../models/Product');

// Get all categories with product counts
// exports.getCategoriesWithCounts = async (req, res) => {
//     try {
//         // Get unique categories with count of products in each
//         const categoryCounts = await Product.aggregate([
//             { $group: { _id: "$category", count: { $sum: 1 } } },
//             { $sort: { _id: 1 } } // Sort by category name
//         ]);

//         // Format response
//         const categories = categoryCounts.map(category => ({
//             name: category._id,
//             count: category.count
//         }));

//         res.status(200).json({ categories });
//     } catch (error) {
//         console.log(error);
//         res.status(500).json({ message: "Internal server error", error: error.message });
//     }
// };
exports.getCategoriesWithCounts = async (req, res) => {
    try {
      // Aggregate categories with product count and first image
      const categoryData = await Product.aggregate([
        {
          $sort: { createdAt: -1 } // Optional: to get the most recent products first
        },
        {
          $group: {
            _id: "$category",
            count: { $sum: 1 },
            firstImages: { $first: "$images" }
          }
        },
        {
          $project: {
            _id: 0,
            name: "$_id",
            count: 1,
            image: { $arrayElemAt: ["$firstImages", 0] } // Get first image from the array
          }
        },
        {
          $sort: { name: 1 }
        }
      ]);
  
      res.status(200).json({ categories: categoryData });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        message: "Internal server error",
        error: error.message
      });
    }
  };
  

// Get products by category
exports.getProductsByCategory = async (req, res) => {
    try {
        const { category } = req.params;
        
        // Validate that the category exists in the enum
        const validCategories = ['Living Room', 'Bedroom', 'Dining Room', 'Mirror'];
        if (!validCategories.includes(category)) {
            return res.status(400).json({ message: "Invalid category" });
        }

        // Fetch products from the specified category
        const products = await Product.find({ category });
        
        if (products.length === 0) {
            return res.status(200).json({ message: "No products found in this category", products: [] });
        }

        res.status(200).json({ products });
    } catch (error) {
        console.log(error);
        res.status(500).json({ message: "Internal server error", error: error.message });
    }
};