import express from 'express';
import { Authenticate } from '../middleware/Authentication';
import { createTransaction, editTransaction, getTransaction } from '../controller/TransactionController';
const TransactionRoute = express.Router()

TransactionRoute.post('/create', Authenticate, createTransaction)
TransactionRoute.post('/list', Authenticate, getTransaction)
TransactionRoute.post('/update', Authenticate, editTransaction)

export default TransactionRoute