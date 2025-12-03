const express = require('express');
const router = express.Router();

const controller = require('./controller');

router.post('/', controller.sendMessage);
router.get('/', controller.getMessages);
router.get('/chat-room', controller.getChatRoom);

module.exports = router;