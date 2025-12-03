const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;
const cloudinary = require('cloudinary').v2;

cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});

const transactionsModel = require('../../../models/transactions');

module.exports = {
    closeDeal : async(req, res, next)=>{
        try {
            const {seller_id, amount, product_id, method, description, status, paidAt, transaction_id, commission} =  req.body;
            const user = req.user;
            
            const data = {
                user_id: new ObjectId(user._id),
                seller_id: new ObjectId(seller_id),
                amount,
                method,
                description,
                status,
                paidAt: paidAt || new Date(),
                product_id: product_id,
                transaction_id: transaction_id || '123456',
                transaction_type: 'credit',
                commission
            }
            
            //storing transaction in DB
            await transactionsModel.create(data);

            res
            .status(200)
            .json({ success : true });

        } catch (error) {
            console.log(error);
            next(error);
        }
    },
}