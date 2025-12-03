// const xlsx = require("xlsx");
const fs = require("fs/promises");
const path =  require('path');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const bcrypt = require('bcrypt');
const axios = require('axios');
const mongoose = require('mongoose');

const sendGrid = require('../config/sendgrid');
const ObjectId = mongoose.Types.ObjectId;
const { closeWS, clearRealTimeSessions, clearChatHistory } = require('../modules/v1/AI/controller');

const MessageModel = require('../models/messages');
const ChatRoomModel = require('../models/chat_rooms');

const getJWTToken = (data, time)=>{

    const token = jwt.sign(data, process.env.JWT_SECRET_KEY, {expiresIn : time})
    return token;
}

const sendEmail = (email, subject, text)=>{
    
    const message = {
        to : email,
        from : process.env.SENDER_EMAIL,
        subject : subject,
        text : text
    }

    sendGrid.send(message)
    .then(response => console.log('Email sent : ', response))
    .catch(error => console.log('Error in email sending : ', error));
    // const transporter = nodemailer.createTransport({
    //     service: 'gmail',
    //     auth: {
    //         user: process.env.SMTP_EMAIL,
    //         pass: process.env.SMTP_PASSWORD
    //     }
    // });

    // const mailOptions = {
    //     from: process.env.SMTP_EMAIL,
    //     to: email,
    //     subject: subject,
    //     text: text
    // };

    // console.log(process.env.SMTP_EMAIL, process.env.SMTP_PASSWORD)
    // transporter.sendMail(mailOptions, function(error, info){
    //     if (error) {
    //         console.log(error);
    //     } else {
    //         console.log('Email sent: ' + info.response);
    //     }
    // });
}


// const sendOTP = (phone, OTP)=>{
//     const accountSid = process.env.TWILIO_ACCOUNT_SID;
//     const authToken = process.env.TWILIO_AUTH_TOKEN;

//     const client = require('twilio')(accountSid, authToken);

//     client.messages
//     .create({
//         messagingServiceSid: process.env.TWILIO_MESSAGING_SERVICE_SID,
//         to: phone,
//         body: `Your Verification OTP is ${OTP}`,
//     })
//     .then(message => {
//         console.log(`✅TWILIO OTP sent: ${OTP} | SID: ${message.sid}`);
//     })
//     .catch(err => {
//         console.error('❌TWILIO Failed to send OTP:', err);
//     });

//     // client.verify.v2.services(process.env.TWILIO_MESSAGING_SERVICE_ID)
//     //   .verifications
//     //   .create({to: '+919982019540', channel: 'sms'})
//     //   .then(verification => console.log(verification.sid));

//     // console.log('-----------sendOTP', accountSid, authToken, client);
//     // client.verify.v2.services(process.env.TWILIO_MESSAGING_SERVICE_ID)
//     //     .verificationChecks
//     //     .create({to: '+918000727389', code: '989898'})
//     //     .then(verification_check => console.log(verification_check.status));
// }

const decodeToken = (token)=>{
    try {
        const decodedToken = jwt.verify(token, process.env.JWT_SECRET_KEY);
        return decodedToken;
    } catch (error) {
        return {
            isError: true
        }
    }
}

const hashPassword =async (password)=>{
    const hashedPassword = await bcrypt.hash(password, Number(process.env.BCRYPT_ROUNDS));
    return hashedPassword;
}

const matchPassword = async(password, hashedPassword)=>{
    return await bcrypt.compare(password, hashedPassword);
}

const getLocationUsingCoordinates = async(lat, long)=>{
    if(!(lat && long))return {};

    const response = await axios(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${long}`,
         {
            headers: {
                // Must clearly identify your app and provide contact info
                "User-Agent": `AI-Marketplace/1.0 (${process.env.SERVER_DOMAIN};)`,
                // Optional but helpful if routed through your domain
                "Referer": process.env.SERVER_URL
            }
        }
    );
    // console.log(response.data.address);
    return response.data.address;
}
const getCityNameUsingLocation=(location)=>{
  return (
    location.city
    || location.town
    || location.village
    || location.hamlet
    || location.municipality
    || location.county
    || location.state
    || location.country
  );
}
function toRadians(deg) {
  return deg * (Math.PI / 180);
}
//haversine formula to calulate dist. btw coordinates 
//returns in Meters
function getDistanceBetweenCoordinates(lat1, lon1, lat2, lon2) {
    if(!(lat1 && lon1) || !(lat2 && lon2))return 0;
    const R = 6371e3; // Earth mean radius in meters (use 6371 for km)
    const φ1 = toRadians(lat1);
    const φ2 = toRadians(lat2);
    const Δφ = toRadians(lat2 - lat1);
    const Δλ = toRadians(lon2 - lon1);

    const a =
        Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);

    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c; // distance in meters
}


const createOffer=async(data)=>{
    const offer = {
        sender: data.senderId,
        receiver: data.receiverId,
        message_type: 'offer',
        offered_price: data.offered_price,
        offer_status: 'pending',
        offered_by: data.senderId
    }

    const offerCreated = await MessageModel.create(offer);
    return offerCreated._id;
}
const acceptOffer=async(data)=>{
    const offerUpdated = {
        offer_status: 'accepted',
        offered_by: data.acceptedBy
    }

    await MessageModel.updateOne({_id: data.offerId}, { $set: offerUpdated});
}
const rejectOffer=async(data)=>{
    const offerUpdated = {
        offer_status: 'rejected',
        offered_by: data.declinedBy
    }

    await MessageModel.updateOne({_id: data.offerId}, { $set: offerUpdated});
}

const getChatRoomId = async(senderId, receiverId) =>{
    const filter = {
        sender: { $in: [new ObjectId(senderId), new ObjectId(receiverId)] },
        receiver: { $in: [new ObjectId(senderId), new ObjectId(receiverId)] },
    };

    let room = await ChatRoomModel.findOne(filter);
    if(!room){
        room = await ChatRoomModel.create({sender: senderId, receiver: receiverId});
    }   
    return room._id.toString();
}

const clearPreviousChatWebSocket= (userId)=>{
    //clearing chatbot streaming ws-connections and chatHistory
    closeWS(userId);
    clearRealTimeSessions(userId);
    clearChatHistory(userId);
}

module.exports = {
    getJWTToken, 
    sendEmail, 
    decodeToken, 
    hashPassword, 
    matchPassword, 
    getLocationUsingCoordinates, 
    getCityNameUsingLocation,
    getDistanceBetweenCoordinates,
    createOffer, 
    acceptOffer, 
    rejectOffer, 
    getChatRoomId,
    clearPreviousChatWebSocket
}
