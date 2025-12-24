import express from 'express';
import { Authenticate } from '../middleware/Authentication';
import { getDashboardData } from '../controller/MiscController';
const DashboardRoute = express.Router()

DashboardRoute.post('/getData', Authenticate, getDashboardData)

export default DashboardRoute