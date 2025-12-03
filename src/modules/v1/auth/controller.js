
const userModel = require('../../../models/users');
const { getJWTToken, sendEmail, decodeToken, hashPassword, matchPassword } = require('../../../utils/helperFunctions');
const { CustomError } = require('../../../utils/customError');

module.exports = {
    register : async(req, res, next) =>{
        try {
            const {name, phone, email, password, confirm_password} = req.body;

            const user = await userModel.findOne({
                $or : [
                    {phone},
                ]
            });
            if(user){
                throw new CustomError(400, 'Phone already exists');
            }
            if(password != confirm_password){
                throw new CustomError(400, 'Password not matched');
            }

            const data = {
                name,
                phone,
                email,
                password : await hashPassword(password),
                otp : 1234,
                otp_check_remaining_limit : 3,
                otp_expiry_time : new Date(Date.now() + 3*60*1000),
                otp_type : 'logged_in'
            }
            const userCreated = await userModel.create(data);

            const response = {
                user_id : userCreated._id
            }
            res.status(201)
            .json({success : true, message : 'Please check your mobile for OTP', response});
        } catch (error) {
            next(error);
        }
    },
    verifyOTP : async(req, res, next) =>{
        try {
            let { otp, user_id} = req.body;

            const user = await userModel.findOne({_id : user_id});
            if(!user){
                throw new CustomError(400, 'User not registered');
            }else if(!user.otp || user.otp_type != 'logged_in' ){
                throw new CustomError(400, 'OTP is invalid');
            }

            const otpExpiryTime = (new Date(user.otp_expiry_time)).getTime();
            if(otpExpiryTime < Date.now()){
                throw new CustomError(400, 'OTP has expired');
            }else if(!user.otp_check_remaining_limit){
                throw new CustomError(400, 'OTP check limit ended');
            }else if(user.otp != otp){
                user.otp_check_remaining_limit -= 1;
                await user.save();
                throw new CustomError(400, 'OTP is Invalid');
            }

            user.otp = null;
            user.otp_check_remaining_limit = null;
            user.otp_expiry_time =null;
            user.otp_type = null;

            const jwtPayload = {
                _id : user._id,
                access_type : 'logged_in'
            }
            const token = getJWTToken(jwtPayload, '30d');
            user.access_token = token;
            await user.save();

            const response = {
                _id : user._id,
                name : user.name,
                email : user.email,
                phone : user.phone,
                access_token : token
            }
            return res
                .status(200)
                .json({success : true, message : 'User verified successfully', data : response});

        } catch (error) {
            next(error);
        }
    },
    resendOTP : async(req, res, next) =>{
        try {
            const {phone, otp_type} = req.body;

            const user = await userModel.findOne({phone});
            if(!user){
                throw new CustomError(400, 'User not registered');
            }

            user.otp = 1234;
            user.otp_check_remaining_limit = 3;
            user.otp_expiry_time = new Date(Date.now() + 3*60*1000);
            user.otp_type = otp_type == 'forgot_password' ? 'forgot_password' : 'logged_in';

            await user.save();

            const data = {
                user_id : user._id,
            }
            // const token = getJWTToken(data, 300);            

            // const emailSubject = 'Verify your email to reset the password!'
            // const emailVerifyLink = `${process.env.MOBILE_APP_RESET_PASSWORD_PAGE_PATH}?token=${token}`;
            // const emailText = `Please click on the link given below to reset your password \n ${emailVerifyLink}`
            // sendEmail(email, emailSubject, emailText);

            res.status(201)
            .json({success : true, message : 'A OTP has been sent to your Phone', data});
        } catch (error) {
            next(error);
        }
    },
    resetPassword : async(req, res, next) =>{
        try {
            const {user_id, password, confirm_password, otp} = req.body;
            
            const user = await userModel.findOne({_id : user_id});
            if(!user){
                throw new CustomError(400, 'User not registered');
            }else if(!user.otp || user.otp_type != 'forgot_password' ){
                throw new CustomError(400, 'OTP is invalid');
            }

            if(password != confirm_password){
                throw new CustomError(400, 'Confirm password not matched');
            }else if(await matchPassword(password, user.password)){
                throw new CustomError(400, 'New password can\'t be same as old password');
            }

            const otpExpiryTime = (new Date(user.otp_expiry_time)).getTime();
            if(otpExpiryTime < Date.now()){
                throw new CustomError(400, 'OTP has expired');
            }else if(!user.otp_check_remaining_limit){
                throw new CustomError(400, 'OTP check limit ended');
            }else if(user.otp != otp){
                user.otp_check_remaining_limit -= 1;
                await user.save();
                throw new CustomError(400, 'OTP is Invalid');
            }

            user.otp = null;
            user.otp_check_remaining_limit = null;
            user.otp_expiry_time =null;
            user.otp_type = null;
            // const decodedToken = decodeToken(token);
            // if(decodedToken.access_type != 'forgot_password'){
            //     throw new CustomError(400, 'Invalid token');
            // }else if(password != confirm_password){
            //     throw new CustomError(400, 'Confirm password not matched');
            // }

            // if(await matchPassword(password, user.password)){
            //     throw new CustomError(400, 'New password can\'t be same as old');
            // }

            user.password = await hashPassword(password);
            await user.save();

            // const emailSubject = 'Password reset successfully'
            // const emailText = `Password has been updated successfully`
            // sendEmail(user.email, emailSubject, emailText);

            res.status(201)
            .json({success : true, message : 'Password has been reset successfully'});
        } catch (error) {
            next(error);
        }
    },
    loginByPhone : async(req, res, next) =>{
        try {
            const {phone} = req.body;

            const user = await userModel.findOne({phone});
            if(!user){
                throw new CustomError(401, 'User not registered', 'login');
            }
            user.otp = 1234;
            user.otp_check_remaining_limit = 3;
            user.otp_expiry_time = new Date(Date.now() + 3*60*1000);
            user.otp_type = 'logged_in';
            await user.save();

            const response = {
                user_id : user._id
            }
            res.status(201)
            .json({success : true, message : 'Please check your mobile for OTP', response});
        } catch (error) {
            next(error);
        }
    },
    loginByEmail : async(req, res, next) =>{
        try {
            const {email, password} = req.body;

            const user = await userModel.findOne({email});
            if(!user){
                throw new CustomError(401, 'User not registered', 'login');
            }

            const isMatched = await matchPassword(password, user.password);
            if(!isMatched){
                throw new CustomError(401, 'Invalid credentials', 'login');
            }

            const jwtPayload = {
                _id : user._id,
                access_type : 'logged_in'
            }
            const token = getJWTToken(jwtPayload, '30d');
            user.access_token = token;
            await user.save();

            const response = {
                _id : user._id,
                name : user.name,
                email : user.email,
                phone : user.phone,
                access_token : token
            }
            console.log(response, '============Log-in-API response to client');
            return res
                .status(200)
                .json({success : true, message : 'User verified successfully', data : response});
        } catch (error) {
            next(error);
        }
    },
}