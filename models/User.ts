import mongoose, { Schema, type Document } from 'mongoose';

export interface IUser extends Document {
    username: string
    email: string;
    password: string;
    cartData: unknown[];
    verified: boolean;
    verificationToken: string | null;
    verificationTokenCreatedAt: Date | null;
    resetPasswordToken: string | null;
    resetPasswordExpires: Date | number | null;
    lastLoginAttempt: Date | null;
    failedLoginAttempts: number;
    refreshToken: string | null;
}

//to create a schema for user
const userSchema = new Schema<IUser>(
{
        username: {
            type: String,
            required: true,
            unique: true,
        },
        email: {
            type: String,
            required: true,
            unique: true,
        },
        password: {
            type: String,
            required: true,
        },
        cartData: {
            type: Array,
            default: [],
        },
        verified: {
            type: Boolean,
            default: false,
        },
        verificationToken: {
            type: String,
            default: null,
        },
        verificationTokenCreatedAt: {
            type: Date,
            default: null,
        },
        resetPasswordToken: {
            type: String,
            default: null,
        },
        resetPasswordExpires: {
            type: Date,
            default: null,
        },
        lastLoginAttempt: {
            type: Date,
            default: null,
        },
        failedLoginAttempts: {
            type: Number,
            default: 0,
        },
        refreshToken: {
            type: String,
            default: null,
        },
},
    {
        timestamps: true,
        minimize: false,
    }
);

//to export the schema
export default mongoose.model<IUser>('user', userSchema);

