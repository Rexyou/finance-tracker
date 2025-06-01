import express from 'express';
import { Authenticate } from '../middleware/Authentication';
import { createTransactionLabel, editTransactionLabel, getTransactionLabel } from '../controller/TransactionLabelController';
const TransactionLabelRoute = express.Router()

TransactionLabelRoute.post('/create', Authenticate, createTransactionLabel)
TransactionLabelRoute.post('/list', Authenticate, getTransactionLabel)
TransactionLabelRoute.post('/update', Authenticate, editTransactionLabel)

export default TransactionLabelRoute