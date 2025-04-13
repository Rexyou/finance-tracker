import { type HydratedDocument, type InferSchemaType, model, Schema } from "mongoose";

const userSchema = new Schema({
    username: { type: String, required: true, unique: true },
    firstName: { type: String, required: true },
    lastName: { type: String, required: true },
    password: { type: String, required: true },
    pin: { type: Number },
    country: { type: String, required: true },
    countryCode: { type: Number, required: true },
    phoneNumber: { type: Number, required: true, unique: true },
    email: { type: String, required: true, unique: true },
    status: { type: String, default: "inactive" },
    loginAttempts: { type: Number, default: 0 },
    lastLoginAt: { type: Date }
}, {
    timestamps: true
})

export type UserSchema = InferSchemaType<typeof userSchema>;
export type UserDocument = HydratedDocument<UserSchema>;

export const UserModel = model("User", userSchema);

