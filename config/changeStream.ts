import mongoose from 'mongoose';
import type { Server as SocketIOServer } from 'socket.io';

export function setupChangeStreams(io: SocketIOServer): void {
    const Order = mongoose.model('Order');
    const Product = mongoose.model('Product');

    const orderChangeStream = Order.watch([], { fullDocument: 'updateLookup' });
    const productChangeStream = Product.watch([], { fullDocument: 'updateLookup' });

    orderChangeStream.on('change', (change: any) => {
            try {
            if (change.operationType === 'insert') {
                io.to('dashboard-updates').emit('new-order', {
                    type: 'new-order',
                    data: change.fullDocument,
                });
            } else if (change.operationType === 'update') {
                io.to('dashboard-updates').emit('order-updated', {
                    type: 'order-updated',
                    documentId: change.documentKey._id,
                    updatedFields: change.updateDescription?.updatedFields || {},
                });
            } else if (change.operationType === 'delete') {
                io.to('dashboard-updates').emit('order-deleted', {
                    type: 'order-deleted',
                    documentId: change.documentKey._id,
                });
            }
        } catch (error) {
            console.error('Error processing order change stream:', error);
        }
    }).on('error', (error: Error) => {
        console.error('Order change stream error:', error);
        setTimeout(() => setupChangeStreams(io), 5000);
    });

    productChangeStream.on('change', (change: any) => {
            try {
            if (change.operationType === 'insert') {
                io.to('dashboard-updates').emit('new-product', {
                    type: 'new-product',
                    data: change.fullDocument,
                });
            } else if (change.operationType === 'update') {
                io.to('dashboard-updates').emit('product-updated', {
                    type: 'product-updated',
                    documentId: change.documentKey._id,
                    updatedFields: change.updateDescription?.updatedFields || {},
                });

                if (change.updateDescription?.updatedFields?.isOutOfStock !== undefined) {
                    io.to('dashboard-updates').emit('inventory-changed', {
                        productId: change.documentKey._id,
                        isOutOfStock: change.updateDescription.updatedFields.isOutOfStock,
                    });
                }
            } else if (change.operationType === 'delete') {
                io.to('dashboard-updates').emit('product-deleted', {
                    type: 'product-deleted',
                    documentId: change.documentKey._id,
                });
            }
        } catch (error) {
            console.error('Error processing product change stream:', error);
        }
    }).on('error', (error: Error) => {
        console.error('Product change stream error:', error);
        setTimeout(() => setupChangeStreams(io), 5000);
    });
    
    console.log('Change streams initialized');
}