// const fs = require('fs').promises;
// const path = require('path');

const { CustomError } = require("../utils/customError");
const { decodeToken } = require("../utils/helperFunctions");
const userModel = require('../models/users');

// const logPath = path.join(__dirname, 'error_log_file.log');

const isLoggedInMiddleware = async(req, res, next) =>{
    try{
        const authorization = req.headers?.authorization;
        if(!authorization){
            throw new CustomError(401, 'No token found', 'isLoggedInMiddleware');
        }

        const accessToken = authorization.split(' ')[1];
        if(!accessToken){
            throw new CustomError(401, 'No token found', 'isLoggedInMiddleware');
        }
        if(accessToken == 'undefined'){
            throw new CustomError(401, `Received undefined, Incorrect token`, 'isLoggedInMiddleware');
        }
        
        // console.log(accessToken, '------------accesstoken');

        const decodedToken = decodeToken(accessToken);
        if(typeof(decodedToken) == 'object' && decodedToken.isError){
            throw new CustomError(401, `${accessToken} received, Incorrect token`, 'isLoggedInMiddleware');
        }
        if(decodedToken.access_type != 'logged_in'){
            throw new CustomError(401, 'No token found', 'isLoggedInMiddleware');
        }
        
        const user = await userModel.findOne({_id : decodedToken._id});
        if(!user){
            throw new CustomError(401, 'User not exists', 'isLoggedInMiddleware');
        }

        req.user = user;
        next();
    }catch(error){
        console.log(error);
        next(error)
    }
}

module.exports = isLoggedInMiddleware