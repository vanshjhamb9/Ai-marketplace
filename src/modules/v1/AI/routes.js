const express=require('express');
const router = express.Router();

const controller = require('./controller');

router.post('/get-query-info', controller.chatAssistant);

module.exports = router;