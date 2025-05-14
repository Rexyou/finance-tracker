import express from 'express';
import { Authenticate } from '../middleware/Authentication';
import { createAccount, editAccount, getAccountList } from '../controller/AccountController';
const AccountRoute = express.Router()

AccountRoute.post('/create', Authenticate, createAccount)
AccountRoute.post('/list', Authenticate, getAccountList)
AccountRoute.post('/update', Authenticate, editAccount)

export default AccountRoute