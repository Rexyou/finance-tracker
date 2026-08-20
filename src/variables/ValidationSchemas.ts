import { z } from "zod";
import { AccountStatus, AccountType, TransactionLabelStatus, TransactionType } from "./Enums";
import mongoose from "mongoose";
import { resolveDateRange, toEndOfDayUtc } from "../utility/GeneralFunctions";

// Standard sharing validation
const usernameValidator = z.string().min(8).max(16).regex(/^[a-zA-Z0-9]+$/);
const emailValidator = z.string().email();
// Digits as strings, not numbers. A 17-digit account number exceeds 2^53 and is
// already mangled by JSON.parse before it reaches us, and a numeric type also
// drops significant leading zeros. Clients must send these as JSON strings.
const accountNumberValidator = z.string().regex(/^\d{6,17}$/, 'Account number must be 6-17 digits');
const phoneNumberValidator = z.string().regex(/^\d{4,15}$/, 'Phone number must be 4-15 digits'); // E.164 caps at 15

  const objectIdSchema = z.string().refine((val) => mongoose.Types.ObjectId.isValid(val), {
    message: 'Invalid ObjectId',
});

const passwordValidator = z.string().min(8).max(16);

const labelValidator = z.string().min(3).max(32).regex(/^[a-zA-Z0-9\s\-_&(),.'"]+$/);
const hexColorRegex = /^#(?:[0-9a-fA-F]{3}){1,2}$/;

// z.number() accepts Infinity (it only rejects NaN), and JSON.parse turns 1e999
// into Infinity. Infinity.toFixed(2) is the string "Infinity", which
// Decimal128.fromString accepts — so without .finite() a single request can
// permanently corrupt an account balance. .max() also keeps values below the
// 1e21 threshold where toFixed switches to exponential notation.
const MAX_MONEY = 1_000_000_000;
const moneyValidator = z.number().finite().nonnegative().max(MAX_MONEY);
const positiveMoneyValidator = z.number().finite().positive().max(MAX_MONEY);

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
  // phoneNumber stores the FULL international number; countryCode is display
  // metadata and deliberately not part of identity (uniqueness is on phoneNumber
  // alone, which only works because the stored value is globally unique).
  // Enforcing the prefix here is what stops the two from drifting apart — half the
  // existing rows had drifted before this was added.
  .refine((v) => v.phoneNumber.startsWith(String(v.countryCode)), {
      message: 'phoneNumber must include the country code',
      path: ['phoneNumber'],
  })

export const LoginSchema = z.object({
    username: z.string().min(1).refine(
      (value) => {
        const isUsername = usernameValidator.safeParse(value).success;
        const isEmail = emailValidator.safeParse(value).success;
        // phoneNumber is a string now — passing Number(value) here made isPhone
        // permanently false, which locked out any phone short enough to also fail
        // usernameValidator min(8).
        const isPhone = phoneNumberValidator.safeParse(value).success;
        
        return isUsername || isEmail || isPhone;
      },
      {
        message: 'Must be a valid username (8-16 alphanumeric), email, or phone number (4-16 digits)',
      }
    ),
    password: passwordValidator,
}).strict()

const baseAccountFields = {
  accountNumber: accountNumberValidator,
  label: labelValidator,
};

const balanceTracking = (type: AccountType) =>
  z.object({ type: z.literal(type), ...baseAccountFields, balance: moneyValidator }).strict();

export const CreateAccountSchema = z.discriminatedUnion("type", [
  balanceTracking(AccountType.DebitAccount),
  // Cash is physical money — no account number. AccountService.assertUnique
  // falls back to the account's own label for uniqueness in this case.
  z.object({ type: z.literal(AccountType.Cash), label: labelValidator, balance: moneyValidator }).strict(),
  z.object({ type: z.literal(AccountType.CreditAccount), ...baseAccountFields, limit: positiveMoneyValidator }).strict(),
]);

// `balance` is deliberately absent: it is only ever moved by applyBalanceDelta as
// a consequence of a transaction. Account creation is now the sole injection
// point for the `balance >= 0` invariant the update guards depend on.
export const UpdateAccountSchema = z.object({
  accountId: objectIdSchema,
  label: labelValidator.optional(),
  accountNumber: accountNumberValidator.optional(),
  status: z.nativeEnum(AccountStatus).optional(),
  limit: positiveMoneyValidator.optional(),
}).strict()


export const CreateTransactionLabelSchema = z.object({
  labelName: z.string().nonempty().max(25),
  labelColor: z.string().regex(hexColorRegex).optional(),
}).strict()

export const UpdateTransactionLabelSchema = z.object({
  transactionLabelId: objectIdSchema,
  labelName: z.string().nonempty().max(25).optional(),
  labelColor: z.string().regex(hexColorRegex).optional(),
  status: z.nativeEnum(TransactionLabelStatus).optional(),
}).strict()

export const CreateTransactionSchema = z.object({
  transactionType: z.nativeEnum(TransactionType),
  accountId: objectIdSchema,
  transactionLabelId: objectIdSchema,
  amount: positiveMoneyValidator.min(1),
  remarks: z.string().max(255).optional()
}).strict()

export const UpdateTransactionSchema = z.object({
  transactionId: objectIdSchema,
  transactionLabelId: objectIdSchema.optional(),
  amount: positiveMoneyValidator.min(1).optional(),
  remarks: z.string().max(255).optional()
}).strict()

export const DeleteTransactionSchema = z.object({
  transactionId: objectIdSchema,
}).strict()

// Unbounded size let one request pull an entire date window into the heap.
const MAX_PAGE_SIZE = 100;
// z.number().int() accepts 1e21, and (page-1)*size then overflows int64.
const MAX_PAGE = 10_000;
// Only indexed fields. Sorting on anything else forces a blocking in-memory sort
// that dies at 32MB and surfaces as a raw driver error, i.e. a 500 for user input.
const SORTABLE_FIELDS = ['createdAt', 'updatedAt'] as const;

export const PaginateSchema = z.object({
    page: z.number().int().positive().max(MAX_PAGE),
    size: z.number().int().positive().max(MAX_PAGE_SIZE),
    sort: z.record(z.enum(SORTABLE_FIELDS), z.union([z.literal(1), z.literal(-1)])),
}).strict()

// paginate() already defaults page/size/sort, so requiring them here only forced
// clients to restate the defaults.
const optionalPagination = PaginateSchema.partial().optional().default({});

// For list endpoints whose services ignore dates entirely (accounts, labels).
export const PaginationOnlySchema = z.object({
  pagination: optionalPagination
}).strict()

// Dates are interpreted in UTC — config/env.ts pins the process timezone so an
// offset-less string like "2024-01-01T00:00:00" cannot drift with the host.
// dateFrom takes a bare date as the start of that day (midnight UTC, which is
// what coercion already yields); dateTo widens a bare date to the END of that
// day, so an inclusive $lte range covers the final day instead of only its
// midnight instant.
const dateStartValidator = z.coerce.date();
const dateEndValidator = z.preprocess(toEndOfDayUtc, z.coerce.date());

// dateFrom/dateTo are optional and filled in at parse time, so downstream
// services and aggregation $match stages always receive concrete dates and need
// no undefined handling. The default window also keeps countDocuments bounded,
// which is what makes the { userId: 1, createdAt: -1 } index worthwhile.
export const DatePaginationSchema = z.object({
  dateFrom: dateStartValidator.optional(),
  dateTo: dateEndValidator.optional(),
  pagination: optionalPagination
}).strict()
  .transform((v) => ({ ...v, ...resolveDateRange(v.dateFrom, v.dateTo) }))
  .refine((v) => v.dateFrom <= v.dateTo, {
    message: 'dateFrom must not be after dateTo',
  })
