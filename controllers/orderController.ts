import type { Request, Response } from 'express';
import Order from '../models/Order';
import Payment from '../models/Payment';

const ORDER_STATUSES = ['Pending', 'Shipped', 'Delivered', 'Cancelled'] as const;
type OrderStatus = typeof ORDER_STATUSES[number];

//all orders data for admin panel
export const allOrders = async (req: Request, res: Response) => {
    try {
        const order = await Order.find({})
            .sort({ date: -1 }) 
            .populate('items.productId', 'name')
            .populate('userId', 'username email');
        res.status(200).json({ success: true, order });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

//user order data for frontend
export const userOrders = async (req: Request, res: Response) => {
    try {
        const userId = req.user?._id;
        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const orders = await Order.find({ userId })
            .sort({ date: -1 }) //sort the order by date, newest first
            .populate('items.productId', 'name images'); //populate the productId with title, price and images from the product model
        res.status(200).json({ success: true, orders });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};;

//update order status for admin panel
export const updateOrderStatus = async (req: Request, res: Response) => {
    try {
        const { orderId, status } = req.body as { orderId?: string; status?: string };

        //validate data before updating order status
        if (!orderId || !status) {
            return res.status(400).json({
                success: false,
                message: 'Order ID and status are required',
            });
        }

        if (!ORDER_STATUSES.includes(status as OrderStatus)) {
            return res.status(400).json({
                success: false,
                message: `Status must be one of: ${ORDER_STATUSES.join(', ')}`,
            });
        }

        const updatedOrder = await Order.findByIdAndUpdate(
            orderId,
            { status },
            { new: true }
        );

        if (!updatedOrder) {
            return res.status(404).json({ success: false, message: 'Order not found' });
        }
        res.status(200).json({ success: true, updatedOrder });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({ success: false, message: error.message });
    }
};

//delete an order from the database 
export const deleteOrder = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body as { orderId?: string };
        
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

        const successfulPayment = await Payment.findOne({ orderId, status: 'success' });
        if (successfulPayment) {
            return res.status(409).json({
                success: false,
                message: 'This order has a completed payment attached and cannot be deleted. Consider archiving it instead.',
            });
        }

        // Delete the order
        await Order.findByIdAndDelete(orderId);
        
        res.status(200).json({
            success: true,
            message: "Order successfully deleted"
        });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message
        });
    }
};

//archive an order from the database
export const archiveOrder = async (req: Request, res: Response) => {
    try {
        const { orderId } = req.body as { orderId?: string };

        // Validate input data
        if (!orderId) {
            return res.status(400).json({
                success: false,
                message: 'Order ID is required',
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
                message: 'Order not found',
            });
        }

        res.status(200).json({
            success: true,
            message: 'Order successfully archived',
            order: updatedOrder,
        });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};

// get a single order by id
export const getOrderById = async (req: Request, res: Response) => {
    try {
        const orderId = req.params.id;
        const userId = req.user?._id;

        if (!userId) {
            return res.status(401).json({ success: false, message: 'Not authenticated' });
        }

        const order = await Order.findOne({
            _id: orderId,
            userId,
        });

        if (!order) {
            return res.status(404).json({
                success: false,
                message: "Order not found or you don't have permission to view it",
            });
        }

        res.status(200).json({
            success: true,
            order,
        });
    } catch (error: any) {
        console.log(error);
        res.status(500).json({
            success: false,
            message: error.message,
        });
    }
};