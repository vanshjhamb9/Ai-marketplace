
const express=require('express');
const router = express.Router();

const controller = require('./controller');

router.post('/register', controller.register);
router.post('/verify-otp', controller.verifyOTP);
router.post('/resend-otp', controller.resendOTP);
router.post('/reset-password', controller.resetPassword);
router.post('/login-by-phone', controller.loginByPhone);
router.post('/login-by-email', controller.loginByEmail);
// router.post('/verify-link', controller.verifyLink) //two purpose
// router.post('/forgot-password', controller.forgotPassword)
// router.post('/login', controller.login)

module.exports = router;