import express from 'express';
import { register, login, getProfile } from '../controller/AuthController';
import { Authenticate } from '../middleware/Authentication';
const AuthRoute = express.Router()

AuthRoute.post('/register', register)
AuthRoute.post('/login', login)
AuthRoute.post('/profile', Authenticate, getProfile)

export default AuthRoute