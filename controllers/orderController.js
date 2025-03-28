const Order = require("../models/Order.js");
const User = require("../models/User.js");

//placing orders using cash on delivery method
exports.placeOrder = async (req, res) => {
    const session = await mongoose.startSession(); //Atomicity means that the two operations run to prevent inconsistencies in the database.
    session.startTransaction();
    try {
        const { userId, items, amount, address} = req.body;
        
        const orderData = {
            userId,
            items,
            amount,
            address,
            paymentMethod: "Cash",
            paymentStatus: false,
            date: Date.now()
        };
        // Create and save the order within the session
        const order = new Order(orderData);
        await order.save({session});

        //clear the cart after placing order
        await User.findByIdAndUpdate(userId, {cartData: []}, {session});

        // Commit the transaction if everything is successful
        await session.commitTransaction();
        session.endSession();

        res.status(200).json({success:true, message: "Order placed successfully" });

    } catch (error) {
        // Abort the transaction in case of errors
        await session.abortTransaction();
        session.endSession();
        console.log(error);
        res.status(500).json({success:false, message: error.message});
    }
};

//placing orders using paystack


//all orders data for admin panel
exports.allOrders = async (req, res) => {
    try {
        const order = await Order.find({});
        res.status(200).json({success:true, order});
    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message: error.message});
    }
};

//user order data for frontend
exports.userOrders = async (req, res) => {
    try {
        
        const {userId} = req.body;

        const orders = await Order.find({userId});
        res.status(200).json({success:true, orders});

    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message: error.message});
    }
};

//update order status for admin panel
exports.updateOrderStatus = async (req, res) => {};