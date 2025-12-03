const express = require('express');
const router = express.Router();

const isLoggedInMiddleware = require('../../middlewares/isLoggedInMiddleware');
const { testChatAssistant } = require('./AI/controller');

router.use('/auth', require('./auth/routes'));

router.post('/test/chat', testChatAssistant);
router.get('/test/health', (req, res) => res.json({ success: true, mode: 'test' }));

router.use('/user', isLoggedInMiddleware, require('./user/routes'));
router.use('/products', isLoggedInMiddleware, require('./products/routes'));
router.use('/AI', isLoggedInMiddleware, require('./AI/routes'));
router.use('/messages', isLoggedInMiddleware, require('./messages/routes'));
router.use('/transactions', isLoggedInMiddleware, require('./transactions/routes'));

module.exports = router;