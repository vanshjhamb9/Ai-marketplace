const express = require('express');
const router = express.Router();

const isLoggedInMiddleware = require('../../middlewares/isLoggedInMiddleware');

router.use('/auth', require('./auth/routes'));
router.use('/user', isLoggedInMiddleware, require('./user/routes'));
router.use('/products', isLoggedInMiddleware, require('./products/routes'));
router.use('/AI', isLoggedInMiddleware, require('./AI/routes'));
router.use('/messages', isLoggedInMiddleware, require('./messages/routes'));
router.use('/transactions', isLoggedInMiddleware, require('./transactions/routes'));
module.exports = router;