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

const nameValidator = z.string().min(3).max(32).regex(/^[a-zA-Z]+$/);

const passwordValidator = z.string().min(8).max(16);

const labelValidator = z.string().min(3).max(32).regex(/^[a-zA-Z0-9\s\-_&(),.'"]+$/);
const hexColorRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/;
const dateValidator = z.coerce.date()

export const RegisterSchema = z.object({
    username: usernameValidator,
    password: passwordValidator,
    confirmPassword: passwordValidator,
    country: z.string().min(2).max(3).regex(/^[a-zA-Z0-9]+$/).nonempty(),
    countryCode: z.number().refine(num => num.toString().length >= 2 && num.toString().length <= 3, {
        message: 'Country code must be between 2 and 3 digits',
    }),
    phoneNumber: phoneNumberValidator,
    email: emailValidator.nonempty(),
}).strict()

export const LoginSchema = z.object({
    username: z.string().min(1).refine(
      (value) => {
        const isUsername = usernameValidator.safeParse(value).success;
        const isEmail = emailValidator.safeParse(value).success;
        const phoneNum = Number(value);
        const isPhone = !isNaN(phoneNum) && phoneNumberValidator.safeParse(phoneNum).success;
        
        return isUsername || isEmail || isPhone;
      },
      {
        message: 'Must be a valid username (8-16 alphanumeric), email, or phone number (4-16 digits)',
      }
    ),
    password: passwordValidator,
}).strict()

const baseAccountFields = {
  accountNumber: z.number().refine((num) => {
    const str = num.toString();
    return str.length >= 6 && str.length <= 20;
  }, {
    message: "Account number must be between 6 and 20 digits",
  }),
  label: labelValidator,
};

export const CreateAccountSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal(AccountType.DebitAccount), ...baseAccountFields, balance: z.number() }).strict(),
  z.object({ type: z.literal(AccountType.CreditAccount), ...baseAccountFields, limit: z.number().positive({ message: "Limit must be greater than 0" }) }).strict(),
]);

export const UpdateAccountSchema = z.object({
  accountId: objectIdSchema,
  label: labelValidator.optional(),
  accountNumber: z.number().refine((num) => {
    const str = num.toString();
    return str.length >= 6 && str.length <= 20;
  }, {
    message: 'Account number must be between 6 and 20 digits',
  }).optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  balance: z.number().optional(),
  limit: z.number().positive({ message: "Limit must be greater than 0" }).optional(),
}).strict()


export const CreateTransactionLabelSchema = z.object({
  labelName: z.string().nonempty(),
  labelColor: z.string().regex(hexColorRegex).optional(),
}).strict()

export const UpdateTransactionLabelSchema = z.object({
  transactionLabelId: z.string().nonempty(),
  labelName: z.string().nonempty().optional(),
  labelColor: z.string().regex(hexColorRegex).optional(),
  status: z.nativeEnum(TransactionLabelStatus).optional(),
}).strict()

export const CreateTransactionSchema = z.object({
  transactionType: z.nativeEnum(TransactionType),
  accountId: objectIdSchema,
  transactionLabelId: objectIdSchema,
  amount: z.number().min(1),
  remarks: z.string().optional()
}).strict()

export const UpdateTransactionSchema = z.object({
  transactionId: objectIdSchema.optional(),
  transactionLabelId: objectIdSchema.optional(),
  accountId: objectIdSchema.optional(),
  amount: z.number().min(1).optional(),
  remarks: z.string().optional()
}).strict()

export const DeleteTransactionSchema = z.object({
  transactionId: objectIdSchema.optional(),
}).strict()

export const PaginateSchema = z.object({
    page: z.number().int().positive(),
    size: z.number().int().positive(),
    sort: z.record(z.string(), z.union([z.literal(1), z.literal(-1)])),
}).strict()

export const DatePaginationSchema = z.object({
  dateFrom: dateValidator,
  dateTo: dateValidator,
  pagination: PaginateSchema
}).strict()