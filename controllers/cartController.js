const Cart = require("../models/cart");
const Product = require("../models/Product");

exports.getCart = async (req, res) => {
    try {
        

        // Find the cart for the logged-in user and populate the necessary fields
        const cart = await Cart.findOne({ user: req.user._id })
        
            .populate('items.productID', 'name price images') // Populate product fields
            .populate('user', 'username email'); // Populate user fields

        // Check if cart exists
        if (!cart) {
            return res.status(404).json({ success: false, message: 'Cart not found' });
        }

        // Convert price and total to numbers
        cart.items = cart.items.map((item) => ({
            ...item.toObject(),
            price: Number(item.productID.price),
        }));
        cart.total = Number(cart.total);

        res.status(200).json({ success: true, data: cart });
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

      // Log updated price
      console.log("Updated Item Price:", existingItem.price);
    } else {
      cart.items.push({
        productID,
        quantity,
        price: quantity * product.price, // Ensure it's a number
      });

      console.log("Added New Item to Cart:", {
        productID,
        quantity,
        price: quantity * product.price,
      });
    }

    // Log cart items before reducing total
    console.log("Cart Items Before Total Calculation:", cart.items);

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

    res
      .status(201)
      .json({ success: true, message: "Item added to cart", data: cart });
  } catch (error) {
    console.error("Error in addItemToCart:", error.message);
    res.status(500).json({ success: false, message: error.message });
  }
};

// Remove item from cart
exports.removeItemFromCart = async (req, res) => {
  const { productID } = req.body;

  if (!productID) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid productID" });
  }

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    cart.items = cart.items.filter(
      (item) => item.productID.toString() !== productID
    );

    // Update total as a number
    cart.total = cart.items.reduce((sum, item) => sum + item.price, 0);
    await cart.save();

    // Convert prices back to numbers before sending response
    cart.items = cart.items.map((item) => ({
      ...item.toObject(),
      price: Number(item.price),
    }));
    cart.total = Number(cart.total);

    res
      .status(200)
      .json({ success: true, message: "Item removed from cart", data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};

// Update item in cart
exports.updateItemInCart = async (req, res) => {
  const { productID, quantity } = req.body;

  if (!productID || quantity <= 0) {
    return res
      .status(400)
      .json({ success: false, message: "Invalid productID or quantity" });
  }

  try {
    const cart = await Cart.findOne({ user: req.user._id });
    if (!cart) {
      return res
        .status(404)
        .json({ success: false, message: "Cart not found" });
    }

    const item = cart.items.find(
      (item) => item.productID.toString() === productID
    );
    if (!item) {
      return res
        .status(404)
        .json({ success: false, message: "Item not found in cart" });
    }

    const product = await Product.findById(productID);
    if (!product) {
      return res
        .status(404)
        .json({ success: false, message: "Product not found" });
    }

    item.quantity = quantity;
    item.price = quantity * product.price; // Keep price as a number

    // Update total as a number
    cart.total = cart.items.reduce((sum, item) => sum + item.price, 0);
    await cart.save();

    // Convert prices back to numbers before sending response
    cart.items = cart.items.map((item) => ({
      ...item.toObject(),
      price: Number(item.price),
    }));
    cart.total = Number(cart.total);

    res
      .status(200)
      .json({ success: true, message: "Item updated in cart", data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
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
      .json({ success: true, message: "Cart cleared", data: cart });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
};
