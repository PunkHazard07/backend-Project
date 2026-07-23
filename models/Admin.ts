import mongoose, { Schema, type Document } from 'mongoose';

export interface IAdmin extends Document {
    email: string;
    password: string;
    refreshToken: string | null;
    createdAt: Date;
    updatedAt: Date;
}

// Create a schema
const adminSchema = new Schema<IAdmin>({
    email: {
        type: String,
        required: true,
        unique: true,
        lowercase: true,
        trim: true
    },
    password: {
        type: String,
        required: true
    },
    refreshToken: {
        type: String,
        default: null
    } 
}, {
    timestamps: true
});

// Export the model
export default mongoose.model<IAdmin>('Admin', adminSchema);