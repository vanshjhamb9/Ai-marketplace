const userModel = require('../../../models/users');
const { CustomError } = require('../../../utils/customError');
const { matchPassword, hashPassword } = require('../../../utils/helperFunctions');

module.exports = {
    getDetails : async(req, res, next) =>{
        try {
            const response = {
                _id : req.user._id,
                name : req.user.name,
                email : req.user.email,
                phone : req.user.phone,
                full_address: req.user.full_address || '',
                bank_account_number: req.user.bank_account_number
            }
            res
            .status(201)
            .json({success : true, message : 'User updated successfully', response});
        } catch (error) {
            next(error);
        }
    },
    updateProfile : async(req, res, next) =>{
        try {
            const {name, full_address} = req.body;
            const userId = req.user._id;

            const data = {
                name,
                full_address
            }
            await userModel.updateOne({_id : userId}, {$set : data});

            const response = {
                _id : req.user._id,
                name,
                email : req.user.email,
                phone : req.user.phone,
                full_address
            }
            res
            .status(201)
            .json({success : true, message : 'User updated successfully', response});
        } catch (error) {
            next(error);
        }
    },
    updateBankDetails : async(req, res, next) =>{
        try {
            const { bank_account_number } = req.body;
            const userId = req.user._id;

            const updatedData = {
                bank_account_number
            }

            await userModel.updateOne({_id : userId}, {$set : updatedData});
            
            res
            .status(200)
            .json({success : true, message : 'Bank details updated successfully'});
        } catch (error) {
            console.log(error);    
            next(error);
        }
    },
    changePassword : async(req, res, next) =>{
        try {
            const { old_password, new_password, confirm_password } = req.body;
            const userId = req.user._id;
            
            if(!(await matchPassword(old_password, req.user.password))){
                throw new CustomError(400, 'Old Password not matched', 'changePassword');
            }else if(new_password != confirm_password){
                throw new CustomError(400, 'Confirm Password not matched', 'changePassword');
            }else if(old_password == new_password ){
                throw new CustomError(400, 'Old and new password can\'t be same', 'changePassword');
            }

            await userModel.updateOne({_id : userId}, {$set :{password : await hashPassword(new_password)}});
            
            res
            .status(200)
            .json({success : true, message : 'Password updated successfully'});
        } catch (error) {
            console.log(error);    
            next(error);
        }
    },
    logOut : async(req, res, next) =>{
        try {
            const userId = req.user._id;
    
            await userModel.updateOne({_id : userId}, {$set :{access_token : null}});
            
            res
            .status(200)
            .json({success : true, message : 'User logged out'});
        } catch (error) {
            console.log(error);    
            next(error);
        }
    },
}