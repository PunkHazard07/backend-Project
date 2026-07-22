import jwt from 'jsonwebtoken';

interface AdminLike {
    _id: unknown;
}

interface TokenPair {
    accessToken: string;
    refreshToken: string;
}

export const generateToken = (admin: AdminLike): TokenPair => {
    const { JWT_SECRET, JWT_REFRESH_SECRET } = process.env;

        if (!JWT_SECRET || !JWT_REFRESH_SECRET) {
        throw new Error('JWT_SECRET is missing from the .env file');
    }

        const accessToken = jwt.sign(
        { id: admin._id, role: 'admin' },
        JWT_SECRET,
        { expiresIn: '15m' } // Short-lived access token
    );

        const refreshToken = jwt.sign(
        { id: admin._id },
        JWT_REFRESH_SECRET,
        { expiresIn: '7d' } // Long-lived refresh token
    );

    return { accessToken, refreshToken };
};
