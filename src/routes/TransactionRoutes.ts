import express from 'express';
import { Authenticate } from '../middleware/Authentication';
import { createTransaction, deleteTransaction, editTransaction, getTransaction, getTransactionsByLabel } from '../controller/TransactionController';
const TransactionRoute = express.Router()

TransactionRoute.post('/create', Authenticate, createTransaction)
TransactionRoute.post('/list', Authenticate, getTransaction)
TransactionRoute.post('/update', Authenticate, editTransaction)
TransactionRoute.post('/delete', Authenticate, deleteTransaction)
TransactionRoute.post('/listByLabel', Authenticate, getTransactionsByLabel)

export default TransactionRoute