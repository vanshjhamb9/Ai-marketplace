const express=require('express');
const router = express.Router();

const controller = require('./controller');

router.get('/details', controller.getDetails)
router.put('/update-profile', controller.updateProfile)
router.put('/update-bank-details', controller.updateBankDetails)
router.put('/change-password', controller.changePassword)
router.get('/logout', controller.logOut)
module.exports = router;
