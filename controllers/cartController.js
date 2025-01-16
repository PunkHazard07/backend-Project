const Cart = require('../models/Cart');
const Product = require('../models/Product');

//get cart for a user
exports.getCart = async (req, res) => {
    try {
        //fetch the cart for the logged-in user, populating both items and user details
        const cart = await Cart.findOne({ user: req.user._id })
        .populate('items.productID') // populate the product details for items
        .populate('user', 'name'); // populate the user details
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        res.status(200).json(cart);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

//add item to cart
exports.addItemToCart = async (req, res) => {
    const { productID, quantity } = req.body;

    try {
        const product = await Product.findById(productID);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        let cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            //create a new cart if it doesn't exist
            cart = new Cart({ user: req.user._id });
        }

        //check if the product is already in the cart
        const existingItem = cart.items.find(item => item.productID.toString() === productID);
        if (existingItem) {
            //update the quantity and price
            existingItem.quantity += quantity;
            existingItem.price += quantity * product.price;
        } else {
            //add new item to the cart
            cart.items.push({
                productID,
                quantity,
                price: quantity * product.price
            });
        }
        //update the total price
        cart.total = cart.items.reduce((sum, item)=> sum + item.quantity * item.price, 0);

        await cart.save();
        res.status(201).json(cart);
    } catch (error) {
        res.status (500).json({ message: error.message });
    }
    
};


//remove item from cart
exports.removeItemFromCart = async (req, res) => {
    const { productID } = req.body;

    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        //remove the item
        cart.items =  cart.items.filter(item => item.productID.toString() !== productID);

        //update the total price
        cart.total = cart.items.reduce((sum, item)=> sum + item.quantity * item.price, 0);

        //save the cart
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status (500).json({ message: error.message });
    }
};

//update item in cart
exports.updateItemInCart = async (req, res) => {
    const { productID, quantity } = req.body;

    try {
        const cart = await Cart.findOne({ user: req.user._id });
        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        //update the item
        const item = cart.items.find(item => item.productID.toString() === productID);
        if (!item) {
            return res.status(404).json({ message: 'Item not found' });
        }

        const product = await Product.findById(productID);
        if (!product) {
            return res.status(404).json({ message: 'Product not found' });
        }

        //update the quantity and price
        item.quantity = quantity;
        item.price = quantity * product.price;

        //update the total price
        cart.total = cart.items.reduce((sum, item)=> sum + item.quantity * item.price, 0);

        //save the cart
        await cart.save();
        res.status(200).json(cart);
    } catch (error) {
        res.status (500).json({ message: error.message });
    }
};


//clear cart
exports.clearCart = async (req, res) => {
    try {
        const cart = await Cart.findOneAndUpdate(
            { user: req.user._id },
            { items: [], total: 0 },
            { new: true });

            if (!cart) {
                return res.status(404).json({ message: 'Cart not found' });
            }
            res.status(200).json(cart);
    } catch (error) {
        res.status (500).json({ message: error.message });
    }
}     
