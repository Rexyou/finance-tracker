import type { ObjectId } from "mongodb";
import type { AccountStatus, AccountType } from "./Enums";

export type UserPayload = {
    username: string;
    firstName: string;
    lastName: string;
    password: string;
    country: string;
    countryCode: number;
    phoneNumber: number;
    email: string;
    pin?: number;
    status?: string;
    lastLoginAt?: Date;
}

export type RegisterPayload = UserPayload & { confirmPassword: string }

export type LoginPayload = Pick<UserPayload, 'password'> & { username: string | number }

export type TokenPayload = { id: ObjectId }

export type NonEmpty<T> = T extends null | undefined | '' | [] | Record<string, never> | 0 ? never : T;

export interface AccountPayload {
    type: AccountType;
    accountNumber: number;
    balance?: number | undefined;
}

export type AccountUpdatePayload = {
    type?: AccountType;
    accountNumber?: number;
    balance?: number | undefined;
    status?: AccountStatus;
}

export type VerifyAccount = Omit<AccountPayload, 'balance'> & {
    userId: ObjectId;
};