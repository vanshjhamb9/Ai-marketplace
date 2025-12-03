const mongoose = require('mongoose');
const ObjectId = mongoose.Types.ObjectId;

const cloudinary = require('cloudinary').v2;
cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
});


const MessageModel = require('../../../models/messages');
const { getSocketIO } = require('../../../config/socket/socket_service');
const { getChatRoomId } = require('../../../utils/helperFunctions');

module.exports = {
    sendMessage : async(req, res, next)=>{
        try {
            const {receiver_id, message_type, text_message, voice_duration, voice_status} =  req.body;
            const user = req.user;
            
            const data = {
                sender: new ObjectId(user._id),
                receiver: new ObjectId(receiver_id),
                message_type,
            }
            
            if(message_type == 'text'){
                data.text_message = text_message;

                // const socketIO = getSocketIO();
                // socketIO.to(receiver_id).emit("chat", { message_type, text_message});
            }
            else if(message_type == 'voice'){
                data.voice_status = voice_status;
                data.voice_duration = voice_duration || 0;
            }
            else if(message_type == 'media'){
                const uploadedFiles = req.files?.files;
                if(!uploadedFiles){
                    throw new CustomError(400, 'Media is required');
                }
                const filesArray = uploadedFiles && (Array.isArray(uploadedFiles) || typeof(uploadedFiles) == 'object')
                    ?  Array.isArray(uploadedFiles)  ? uploadedFiles : [uploadedFiles]
                    : [];

                const fileDataArray = filesArray
                .filter(file => file.size/(1024*1024) <= 5 ) //less then 5 mb file.size is in bytes
                .map((file)=>{
                    return new Promise((resolve, reject)=>{
                        cloudinary.uploader.upload(file.tempFilePath, {
                            folder: 'uploads/AI-Marketplace/chat-media', // 👈 your desired folder
                            resource_type: "auto" // 👈 handles images, pdfs, docs, videos, etc.
                        }).then((result)=>{
                            resolve({
                                public_id : result.public_id,
                                media_format : result.format,
                                resource_type: result.resource_type,
                                original_filename: file.name
                            });
                        }).catch(error =>{
                            reject(error);
                        })
                    }) 
                })
                const uploadedMediaList = await Promise.all(fileDataArray);
                data.media_list = uploadedMediaList;

                //sending socket to receiver
                const mediaList = data?.media_list?.map(media =>{
                    return {
                        media_format: media.media_format,
                        original_filename: media.original_filename,
                        url: `${process.env.CLOUDINARY_BASE_URL_CHAT_MEDIA}/${media.resource_type}/upload/v1751423778/${media.public_id}.${media.media_format}`
                    }  
                })
                const socketIO = getSocketIO();
                const chatRoomId = await getChatRoom(user._id, receiver_id);
                socketIO.to(chatRoomId).emit("getMessage", { 
                    senderId: user._id,
                    receiverId: receiver_id,
                    message_type,
                    media_list: mediaList
                });
            }

            //storing product in DB
            const messageAdded = await MessageModel.create(data);

            res
            .status(200)
            .json({success : true });

        } catch (error) {
            console.log(error);
            next(error);
        }
    },

    getMessages : async(req, res, next)=>{
        try {
            let {receiver_id, skip, limit} =  req.query;
            const user = req.user;
            skip = skip || 0;
            limit = limit || 10;
            
            const filter = {
                sender: { $in: [new ObjectId(user._id), new ObjectId(receiver_id)] },
                receiver: { $in: [new ObjectId(user._id), new ObjectId(receiver_id)] },
            };

            //storing product in DB
            let messages = await MessageModel
                .find(filter)
                .sort({createdAt: -1})
                .skip(skip)
                .limit(limit);

            messages = messages.map(message =>{
                if(message.message_type != 'media')return message;
                message.media_list = message?.media_list?.map(media =>{
                    return {
                        media_format: media.media_format,
                        original_filename: media.original_filename,
                        url: `${process.env.CLOUDINARY_BASE_URL_CHAT_MEDIA}/${media.resource_type}/upload/v1751423778/${media.public_id}.${media.media_format}`
                    }  
                })
                return message;
            })

            res
            .status(200)
            .json({success : true, data: {messages} });

        } catch (error) {
            console.log(error);
            next(error);
        }
    },

    getChatRoom : async(req, res, next)=>{
        try {
            let {receiver_id} =  req.query;
            if(!receiver_id){
                throw new CustomError(400, 'Receiver id is required');
            }
            
            const user = req.user;
            
            const chatRoomId = await getChatRoomId(user._id, receiver_id);

            return res
            .status(200)
            .json({success : true, data: { roomId: chatRoomId} });
        } catch (error) {
            console.log(error);
            next(error);
        }
    },
}