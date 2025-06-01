import type { ObjectId } from "mongodb";
import type { AccountStatus, AccountType, TransactionLabelStatus, TransactionType } from "./Enums";

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

export interface TransactionLabelPayload {
    labelName: string;
    labelColor?: string;
}

export type VerifyLabel = Omit<TransactionLabelPayload, 'labelColor'> & {
    userId: ObjectId
}

export interface TransactionLabelUpdatePayload {
    labelName?: string;
    labelColor?: string;
    status?: TransactionLabelStatus
}

export interface TransactionLabelPayload {
    labelName: string;
    labelColor?: string;
}

export interface TransactionPayload {
    transactionType: TransactionType;
    accountId: ObjectId;
    transactionLabelId: ObjectId;
    amount: number;
    remarks?: string
}

export interface TransactionUpdatePayload {
    transactionType?: TransactionType;
    accountId?: ObjectId;
    transactionLabelId?: ObjectId;
    amount?: number;
    remarks?: string
}