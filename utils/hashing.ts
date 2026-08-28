import bcrypt from 'bcrypt';

const SALT_ROUNDS = 10;

export const hashValue = async (plainValue: string): Promise<string> => {
    const salt = await bcrypt.genSalt(SALT_ROUNDS);
    return bcrypt.hash(plainValue, salt);
};

export const compareValue = async (
    plainValue: string,
    hashedValue: string
): Promise<boolean> => {
    return bcrypt.compare(plainValue, hashedValue);
};