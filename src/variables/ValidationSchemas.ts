import { z } from "zod";

// Standard sharing validation
const usernameValidator = z.string().min(8).max(16).regex(/^[a-zA-Z0-9]+$/);
const emailValidator = z.string().email();
const phoneNumberValidator = z.number().refine((num) => {
    const str = num.toString();
    return str.length >= 4 && str.length <= 16;
  }, {
    message: 'Phone number must be between 4 and 16 digits',
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