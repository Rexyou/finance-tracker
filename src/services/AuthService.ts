import type { ObjectId } from "mongodb";
import { type UserDocument, UserModel, UserSchema } from "../schemas/users";
import { CustomError } from "../utility/CustomError";
import { generateToken, getOrSetCache, isDuplicateKey } from "../utility/GeneralFunctions";
import { ErrorMessages } from "../variables/errorCodes";
import type { LoginPayload, RegisterPayload } from "../variables/types";
import bcrypt from "bcryptjs";
import { RedisKeyName, UserStatus } from "../variables/Enums";
import { findOrFail } from "./ModelService";

export class AuthService {

    private constructor() {} 

    static async checkUniqueValue(target: string, value: string | number){ 
        return UserModel.findOne({ [target]: value }, { [target]: 1 }).lean();
    }

    static generateEncryptedPassword(password: string){
        const salt =  bcrypt.genSaltSync(12)
        return bcrypt.hashSync(password, salt)
    }

    static comparePassword(existPassword: string, currentPassword: string){
        return bcrypt.compareSync(currentPassword, existPassword)
    }

    static async register(payload: RegisterPayload){
        const checkUsername = await AuthService.checkUniqueValue('username', payload.username)
        if(checkUsername){
            throw new CustomError(ErrorMessages.UsernameExistsError)
        }

        const checkEmail = await AuthService.checkUniqueValue('email', payload.email)
        if(checkEmail){
            throw new CustomError(ErrorMessages.EmailExistsError)
        }

        const checkPhoneNumber = await AuthService.checkUniqueValue('phoneNumber', payload.phoneNumber)
        if(checkPhoneNumber){
            throw new CustomError(ErrorMessages.PhoneNumberExistsError)
        }

        if(payload.password !== payload.confirmPassword){
            throw new CustomError(ErrorMessages.PasswordMismatchError)
        }

        const generatedPassword = AuthService.generateEncryptedPassword(payload.password)

        const { confirmPassword, ...newPayload } = payload        
        newPayload.password = generatedPassword

        // The three checks above are read-then-write with no transaction, so a
        // concurrent registration still reaches the unique indexes.
        let result
        try {
            result = await UserModel.create(newPayload)
        } catch (err) {
            if(!isDuplicateKey(err)) throw err
            const field = Object.keys((err as { keyPattern?: Record<string, unknown> }).keyPattern ?? {})[0]
            throw new CustomError(
                field === 'email' ? ErrorMessages.EmailExistsError
                : field === 'phoneNumber' ? ErrorMessages.PhoneNumberExistsError
                : ErrorMessages.UsernameExistsError
            )
        }
        const profileData = await AuthService.getProfile(result._id)

        return { token: generateToken(result._id), ...profileData }
    }

    static async login(payload: LoginPayload){
        const { username, password } = payload

        // username / email / phoneNumber are all strings now, so a single $or covers
        // every login form. The old typeof check made the phone branch unreachable.
        const usernameFilter = { $or: [{ username }, { email: username }, { phoneNumber: username }] };

        const user = await findOrFail<UserSchema, { _id: ObjectId; password: string, status: UserStatus }>(
            UserModel,
            usernameFilter,
            { password: 1, _id: 1, status: 1 },
            {},
            ErrorMessages.UsernameOrPasswordError
        )

      const isPasswordValid = AuthService.comparePassword(user.password, password)
        if(!isPasswordValid){
            throw new CustomError(ErrorMessages.UsernameOrPasswordError)
        }

        if(user.status !== UserStatus.Active){
            throw new CustomError(ErrorMessages.UserInactiveError)
        }

        const profileData = await AuthService.getProfile(user._id)

        return { token: generateToken(user._id), ...profileData }
    }

    static async getProfile(userId: ObjectId){
        return await getOrSetCache(`${RedisKeyName.UserData}:${userId}:profile`, 900, ()=> UserModel.findById(userId, { password: 0, __v: 0 }).lean()) as UserDocument
    }
      
};