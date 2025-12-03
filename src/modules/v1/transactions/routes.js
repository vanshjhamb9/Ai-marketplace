const express = require('express');
const router = express.Router();

const controller = require('./controller');

router.post('/close-deal', controller.closeDeal);

module.exports = router;