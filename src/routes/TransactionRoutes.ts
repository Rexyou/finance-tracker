import express from 'express';
import { Authenticate } from '../middleware/Authentication';
import { createTransaction, deleteTransaction, editTransaction, getTransaction } from '../controller/TransactionController';
const TransactionRoute = express.Router()

TransactionRoute.post('/create', Authenticate, createTransaction)
TransactionRoute.post('/list', Authenticate, getTransaction)
TransactionRoute.post('/update', Authenticate, editTransaction)
TransactionRoute.post('/delete', Authenticate, deleteTransaction)

export default TransactionRoute