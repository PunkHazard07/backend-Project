import mongoose, { Schema, Document } from 'mongoose';

export interface ITokenBlocklist extends Document {
    token: string;
    expiresAt: Date;
}

const tokenBlocklistSchema = new Schema<ITokenBlocklist>({
    token: { type: String, required: true, unique: true, index: true },
    expiresAt: { type: Date, required: true },
});

export default mongoose.model<ITokenBlocklist>('TokenBlocklist', tokenBlocklistSchema);