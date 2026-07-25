import type { IUser } from '../models/User';
import type { IAdmin } from '../models/Admin';

declare global {
    namespace Express {
        interface Request {
            user?: IUser;
            admin?: IAdmin
        }
    }
}

export {};