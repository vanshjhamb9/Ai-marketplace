const express = require('express');
const router = express.Router();

router.use('/v1', require('./modules/v1/routes'))

module.exports = router;