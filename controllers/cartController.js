const Cart = require("../models/Cart");
const Product = require("../models/Product");

exports.getCart = async (req, res) => {
  try {
    const userId = req.user._id;

    let cart = await Cart.findOne({ user: userId })
      .populate('items.productID', 'name price images');

    if (!cart) {
      // Return empty cart if none found
      return res.status(200).json({
        success: true,
        data: {
          items: [],
          total: 0,
        },
      });
    }

    const items = cart.items.map((item) => ({
      productID: item.productID._id,
      name: item.productID.name,
      image: item.productID.images?.[0],
      quantity: item.quantity,
      price: item.productID.price,
    }));

    const total = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    res.status(200).json({
      success: true,
      data: {
        items,
        total,
      },
    });
  } catch (error) {
    console.error("Error fetching cart:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};


// Add item to cart
exports.addItemToCart = async (req, res) => {
  const { productID, quantity } = req.body;

  // Validate input
  if (!productID || quantity <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid productID or quantity" });
  }

  try {
    const product = await Product.findById(productID);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    // Check that product price is valid
    if (isNaN(product.price) || product.price <= 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid product price" });
    }

    let cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      cart = new Cart({ user: req.user._id });
    }

    const existingItem = cart.items.find(
      (item) => item.productID.toString() === productID
    );

    if (existingItem) {
      existingItem.quantity += quantity;
      existingItem.price = existingItem.quantity * product.price;

    } else {
      cart.items.push({
        productID,
        quantity,
        price: quantity * product.price, // Ensure it's a number
      });
    }

    // Calculate the total price from all items
    cart.total = cart.items.reduce((sum, item) => {
      console.log("Item Price During Reduce:", item.price); // Log item price
      if (isNaN(item.price)) {
        throw new Error("Invalid price detected for item");
      }
      return sum + item.price;
    }, 0);

    // Validate the total price
    if (isNaN(cart.total) || cart.total < 0) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid total price" });
    }

    console.log("Total Price:", cart.total);

    // Save cart after price updates
    await cart.save();

    // Ensure prices are numbers and return response
    cart.items = cart.items.map((item) => ({
      ...item._doc, // Use _doc to directly access the raw data of the document
      price: Number(item.price),
    }));

    // Convert total to a number
    cart.total = Number(cart.total);

    cart = await Cart.findOne({ user: req.user._id })
      .populate("items.productID", "name price images");

      const items = cart.items.map((item) => ({
        _id: item._id,
        productID: item.productID._id,
        name: item.productID.name,
        image: item.productID.images?.[0],
        quantity: item.quantity,
        price: item.productID.price,
      }));

      res.status(201).json({
        success: true,
        message: "Item added to cart",
        data: {
          items,
          total: cart.total
        }
      })

  
  } catch (error) {
    console.error("Error in addItemToCart:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

exports.removeItemFromCart = async (req, res) => {
    const { productID } = req.body;
  
    if (!productID) {
      return res
        .status(400)
        .json({ success: false, message: "Invalid productID" });
    }
  
    try {
      let cart = await Cart.findOne({ user: req.user._id });
      if (!cart) {
        return res
          .status(404)
          .json({ success: false, message: "Cart not found" });
      }
  
      // Find the item before removing it to calculate proper total
      const itemToRemove = cart.items.find(
        (item) => item.productID.toString() === productID.toString()
      );
  
      if (!itemToRemove) {
        return res
          .status(404)
          .json({ success: false, message: "Item not found in cart" });
      }
  
      cart.items = cart.items.filter(
        (item) => item.productID.toString() !== productID.toString()
      );
  
      // Recalculate total based on remaining items
      cart.total = cart.items.reduce((sum, item) => {
        return sum + (item.price * item.quantity);
      }, 0);
  
      await cart.save();

      //get cart with populated product data 
      cart = await Cart.findOne({ user: req.user._id })
        .populate('items.productID', 'name price images');

        //format items for response
        const items = cart.items.map((item) => ({
          productID: item.productID,
          name: item.productID.name,
          image: item.productID.images?.[0],
          quantity: item.quantity,
          price: item.productID.price,
        }));
  
      res.status(200).json({
        success: true,
        message: "Item removed from cart",
        data: {
          items,
          total: cart.total,
        }
      });
    } catch (error) {
      console.error("Server error:", error);
      res.status(500).json({ success: false, message: error.message });
    }
  };

//increase quantity
exports.increaseItemQuantity = async (req, res) => {
  try {
    const userId = req.user._id;
    const { productID } = req.body;

    console.log(`Backend received request to increase item ${productID} for user ${userId}`);

    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      console.log('cart not found for user', userId);
      return res.status(404).json({ success: false, message: "Cart not found" });
    }
    
    const item = cart.items.find(item => item.productID.toString() === productID);

    if (item) {
        item.quantity += 1;
        item.price = item.price; // keep price unchanged per item
    } else {
        return res.status(404).json({ message: "Item not found in cart" });
    }

    // Update total
    cart.total = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);
    
    await cart.save();
    
    //get cart with populated product data
    cart = await Cart.findOne({ user: userId })
      .populate('items.productID', 'name price images');

      //format items for response
      const items = cart.items.map((item) => ({
        productID: item.productID,
        name: item.productID.name,
        image: item.productID.images?.[0],
        quantity: item.quantity,
        price: item.productID.price,
      }));

    res.status(200).json({
      success: true,
      message: "Quantity Increased",
      data: {
        items,
        total: cart.total,
      }
    });
} catch (err) {
  console.error('Error increasing item quantity:', err);
    res.status(500).json({ error: err.message });
}
};

//decrease quantity
exports.decreaseItemQuantity = async (req, res) => {
  try {
      const  userId  = req.user._id;
      const { productID } = req.body;

      let cart = await Cart.findOne({ user: userId });
      if (!cart) {
        return res.status(404).json({ message: "Cart not found" });
      }

      const item = cart.items.find(item => item.productID.toString() === productID);

      if (!item) {
          return res.status(404).json({ message: "Item not found in cart" });
      }

      if (item.quantity > 1) {
          item.quantity -= 1;
      } else {
          // Optional: Remove the item if quantity drops below 1
          cart.items = cart.items.filter(item => item.productID.toString() !== productID);
      }

      // Update total
      cart.total = cart.items.reduce((sum, item) => sum + item.quantity * item.price, 0);

      await cart.save();

      //get cart with populated product data
      cart = await Cart.findOne({ user: userId })
        .populate('items.productID', 'name price images');

        //format items for response
        const items = cart.items.map((item) => ({
          productID: item.productID,
          name: item.productID.name,
          image: item.productID.images?.[0],
          quantity: item.quantity,
          price: item.productID.price,
        }));

      res.status(200).json({
        success: true,
        message: "Quantity Decreased",
        data: {
          items,
          total: cart.total
        }
      });
  } catch (err) {
      res.status(500).json({ error: err.message });
  }
};


// Clear cart
exports.clearCart = async (req, res) => {
  try {
    const cart = await Cart.findOneAndUpdate(
      { user: req.user._id },
      { items: [], total: 0 }, // Set total as a number
      { new: true }
    );

    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    res
      .status(200)
      .json({ 
        success: true, 
        message: "Cart cleared", 
        data: {items: [], total: 0} });
  } catch (error) {
    console.error("Error clearing cart:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

//merge cart
exports.mergeCart = async (req, res) => {
  try {
    const userId = req.user._id;
    const { items } = req.body;

    if (!items || items.length === 0) {
      return res.status(400).json({ success: false, message: "No items to merge" });
    }

    // Find or create user's cart
    let cart = await Cart.findOne({ user: userId });
    if (!cart) {
      cart = new Cart({ user: userId, items: [], total: 0 });
    }

    await cart.populate('items.productID');

    // Process each local item
    for (const localItem of items) {
      
      const productId = localItem.id || localItem.productID;
      
      if (!productId) {
        console.warn('Missing product ID for item:', localItem);
        continue;
      }

      // Check if product exists in database
      const product = await Product.findById(productId);
      if (!product) {
        console.warn(`Product with ID ${productId} not found, skipping`);
        continue;
      }

      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.productID && item.productID._id.toString() === productId.toString()
      );

      if (existingItemIndex !== -1) {
        // Update existing item
        cart.items[existingItemIndex].quantity += localItem.quantity;
      } else {
        // Add new item to cart
        cart.items.push({
          productID: productId,
          quantity: localItem.quantity,
          price: product.price, // Get current price from product
          image: product.images
        });
      }
    }

    // Recalculate cart total based on current product prices
    cart = await cart.populate('items.productID');
    cart.total = cart.items.reduce((sum, item) => {
      const price = item.productID ? item.productID.price : 0;
      return sum + (price * item.quantity);
    }, 0);

    await cart.save();

    // Return populated cart with full product details
    const populatedCart = await Cart.findById(cart._id).populate('items.productID');

    res.status(200).json({
      success: true,
      message: "Cart merged successfully",
      data: {
        items: populatedCart.items,
        total: populatedCart.total
      }
    });
  } catch (error) {
    console.error("Error merging cart:", error);
    res.status(500).json({ success: false, message: error.message });
  }
};

