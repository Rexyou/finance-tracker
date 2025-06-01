import { z } from "zod";
import { AccountStatus, AccountType, TransactionLabelStatus, TransactionType } from "./Enums";
import mongoose from "mongoose";

// Standard sharing validation
const usernameValidator = z.string().min(8).max(16).regex(/^[a-zA-Z0-9]+$/);
const emailValidator = z.string().email();
const phoneNumberValidator = z.number().refine((num) => {
    const str = num.toString();
    return str.length >= 4 && str.length <= 16;
  }, {
    message: 'Phone number must be between 4 and 16 digits',
  });

const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
  message: 'Invalid ObjectId',
});

export const RegisterSchema = z.object({
    username: usernameValidator.nonempty(),
    firstName: z.string().min(3).max(32).regex(/^[a-zA-Z]+$/).nonempty(),
    lastName: z.string().min(3).max(32).regex(/^[a-zA-Z]+$/).nonempty(),
    password: z.string().min(8).max(16).nonempty(),
    confirmPassword: z.string().min(8).max(16).nonempty(),
    country: z.string().min(2).max(3).regex(/^[a-zA-Z0-9]+$/).nonempty(),
    countryCode: z.number().refine(num => num.toString().length >= 2 && num.toString().length <= 3, {
        message: 'Country code must be between 2 and 3 digits',
    }),
    phoneNumber: phoneNumberValidator,
    email: emailValidator.nonempty(),
})

export const LoginSchema = z.object({
    username: z.union([z.string(), z.number()]).refine((value) => {
        if (typeof value === 'string') {
            return (
              usernameValidator.safeParse(value).success ||
              emailValidator.safeParse(value).success
            );
        }
        
        if (typeof value === 'number') {
            return phoneNumberValidator.safeParse(value).success;
        }
      
        return false;
      }, {
        message: 'Must be a valid username, email, or phone number',
      }),
    password: z.string().min(8).max(16).nonempty(),
})

export const CreateAccountSchema = z.object({
  type: z.nativeEnum(AccountType),
  balance: z.number().optional(),
  accountNumber: z.number().refine((num) => {
    const str = num.toString();
    return str.length >= 6 && str.length <= 20;
  }, {
    message: 'Phone number must be between 6 and 20 digits',
  }),
})

export const UpdateAccountSchema = z.object({
  accountId: z.string().nonempty(),
  type: z.nativeEnum(AccountType).optional(),
  balance: z.number().optional(),
  accountNumber: z.number().refine((num) => {
    const str = num.toString();
    return str.length >= 6 && str.length <= 20;
  }, {
    message: 'Phone number must be between 6 and 20 digits',
  }).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
})

const hexColorRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

export const CreateTransactionLabelSchema = z.object({
  labelName: z.string().nonempty(),
  labelColor: z.string().regex(hexColorRegex).optional(),
})

export const UpdateTransactionLabelSchema = z.object({
  transactionLabelId: z.string().nonempty(),
  labelName: z.string().nonempty().optional(),
  labelColor: z.string().regex(hexColorRegex).optional(),
  status: z.nativeEnum(TransactionLabelStatus).optional(),
})

export const CreateTransactionSchema = z.object({
  transactionType: z.nativeEnum(TransactionType),
  accountId: objectIdSchema,
  transactionLabelId: objectIdSchema,
  amount: z.number().min(1),
  remarks: z.string().optional()
})

export const UpdateTransactionSchema = z.object({
  transactionId: objectIdSchema.optional(),
  transactionType: z.nativeEnum(TransactionType).optional(),
  transactionLabelId: objectIdSchema.optional(),
  accountId: objectIdSchema.optional(),
  amount: z.number().min(1).optional(),
  remarks: z.string().optional()
})