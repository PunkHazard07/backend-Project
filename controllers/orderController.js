const Order = require("../models/Order.js");


//all orders data for admin panel
exports.allOrders = async (req, res) => {
    try {
        const order = await Order.find({})
        .sort({date:-1}) //sort the order by date, newest first
        .populate("items.productId", "name"); 
        res.status(200).json({success:true, order});
    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message: error.message});
    }
};

//user order data for frontend
exports.userOrders = async (req, res) => {
    try {
        
        const userId = req.user._id; //get the user id from the token

        const orders = await Order.find({userId})
        .sort({date:-1})//sort the order by date, newest first
        .populate("items.productId", "name images") //populate the productId with title, price and images from the product model
        res.status(200).json({success:true, orders});

    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message: error.message});
    }
};

//update order status for admin panel
exports.updateOrderStatus = async (req, res) => {
    try {

        const {orderId, status} = req.body;
        //validate data before updating order status
        if (!orderId || !status) {
            return res.status(400).json({
                success:false, 
                message:"Order ID and status are required"
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId, 
            {status}, 
            {new:true});

            if(!updatedOrder) {
                return res.status(404).json({success:false, message:"Order not found"});
            }
            res.status(200).json({success:true, updatedOrder});
    } catch (error) {
        console.log(error);
        res.status(500).json({success:false, message: error.message});
    }
};

//delete an order from the database 
exports.deleteOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        
        // Validate input data
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID is required"
            });
        }

        // Check if the order exists
        const order = await Order.findById(orderId);
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        // Delete the order
        await Order.findByIdAndDelete(orderId);
        
        res.status(200).json({
            success: true,
            message: "Order successfully deleted"
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

//archive an order from the database
exports.archiveOrder = async (req, res) => {
    try {
        const { orderId } = req.body;
        
        // Validate input data
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: "Order ID is required"
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { isArchived: true },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({
                success: false,
                message: "Order not found"
            });
        }

        res.status(200).json({
            success: true,
            message: "Order successfully archived",
            order: updatedOrder
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

// get a single order by id
exports.getOrderById = async (req, res) => {
    try {
        const orderId = req.params.id;
        const userId = req.user._id; // get the user id from the token

        const order = await Order.findOne({
            _id: orderId,
            userId: userId
        });
        
        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found or you don't have permission to view it"
            });
        }

        res.status(200).json({
            success: true,
            order
        });
    } catch (error) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};



