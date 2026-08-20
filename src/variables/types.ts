import type { ObjectId } from "mongodb";
import type { AccountStatus, AccountType, TransactionLabelStatus, TransactionType } from "./Enums";
import { PopulateOptions } from "mongoose";

export type UserPayload = {
    username: string;
    firstName?: string;
    lastName?: string;
    password: string;
    country: string;
    countryCode: number;
    phoneNumber: string;
    email: string;
    pin?: number;
    status?: string;
    lastLoginAt?: Date;
}

export type RegisterPayload = UserPayload & { confirmPassword: string }

// LoginSchema always produces a string; the union invited a phoneNumber branch
// that could never be reached.
export type LoginPayload = Pick<UserPayload, 'password'> & { username: string }

export type TokenPayload = { id: ObjectId }

export type NonEmpty<T> = T extends null | undefined | '' | [] | Record<string, never> | 0 ? never : T;

export interface AccountPayload {
    type: AccountType;
    accountNumber?: string;
    balance?: number | undefined;
    label: string;
    availableCredit?: number | undefined;
    limit?: number | undefined;
    amountUsed?: number | undefined;
}

/**
 * User-controlled. Must stay a subset of UpdateAccountSchema.
 *
 * `type` is immutable after creation; `balance` and `amountUsed` are only ever
 * moved by AccountService.applyBalanceDelta, never set directly from a request.
 */
export type AccountUpdatePayload = {
    label?: string;
    accountNumber?: string;
    status?: AccountStatus;
    limit?: number;
}

/** What editAccount actually hands to Mongoose — includes derived fields. */
export type AccountUpdateDocument = AccountUpdatePayload & {
    availableCredit?: number;
}

/** Money fields that applyBalanceDelta is allowed to move. */
export type BalanceDeltas = Partial<Record<'balance' | 'amountUsed' | 'availableCredit', number>>;

export type VerifyAccount = Pick<AccountPayload, 'type' | 'accountNumber'> & {
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
    transactionLabelId?: ObjectId;
    amount?: number;
    remarks?: string
}

export interface PaginationData {
  page?: number;
  size?: number;
  sort?: Record<string, 1 | -1>;
}

export interface PaginationResult<T> {
  data: T[];
  currentPage: number;
  totalCount: number;
  totalPage: number;
}

export interface PaginateOptions {
  projection?: Record<string, 0 | 1>;
  populate?: PopulateOptions | PopulateOptions[];
  lean?: boolean;
}

export interface FindOrFailParams<T> {
    model: { findOne: (filter: Record<string, any>) => Promise<T | null> };
    filter: Record<string, any>;
    error: string;
}

/** List endpoints whose services ignore date filtering (accounts, labels). */
export interface PaginationPayload {
    pagination: PaginationData
}

export type DatePaginationPayload = PaginationPayload & {
    dateFrom: Date;
    dateTo: Date;
}