const { v4: uuidv4 } = require('uuid');
const path = require('path');
const cloudinary = require('cloudinary').v2;
const { OpenAI } = require('openai');
const axios = require('axios');
const mongoose = require('mongoose');

const ProductModel = require('../../../models/products.js');
const UserModel = require('../../../models/users.js');
const { CustomError } = require('../../../utils/customError.js');
const { getLocationUsingCoordinates, getDistanceBetweenCoordinates, getCityNameUsingLocation } = require('../../../utils/helperFunctions.js');

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

// Initialize OPEN-AI with API key
const openai = new OpenAI({ apiKey : process.env.OPEN_API_KEY });


//-----------common functions
// const resp = voyageAIClient.multimodalEmbed({
//   inputs: [
//     {
//       content: [
//         {
//           type: "text",
//           text: "Title: shoes. Description: shoes. Category: fashion. Subcategory: shoes"
//         }
//       ]
//     }
//   ],
//   model: "voyage-multimodal-3",
//   input_type: "query"
// });

//1536 using openAI
async function getEmbedding1536(text) {
  const response = await openai.embeddings.create({
    model: "text-embedding-3-small",
    input: text,
    dimensions: 1536
  });

  // response.data is an array, we take the first embedding
  return response.data[0].embedding;
}
//It Gives 1024 dimensions using voyage model ( text + images both)
async function embedMultimodal(text, imageUrlsList) {
    const content = [];
    if(text){
        content.push({ type: "text", text});
    }
    if(imageUrlsList?.length){
        imageUrlsList.forEach(url => content.push({ type: "image_url", image_url: url }))
    }

    const payload = {
        inputs : [{content}],
        model: 'voyage-multimodal-3',  // exactly as this string
        input_type: 'query'
    };
    
    const response = await axios.post(
      'https://api.voyageai.com/v1/multimodalembeddings',
      payload,
      {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`
        }
      }
    );

    return response.data.data[0].embedding; // 1024‑dim embedding vector
}

function getDBOldImages(dbImages, restImageURLs){

    const dbOldImages = [];
    const dbOldImagesToDelete = [];
    
    const restImagesObj ={};
    restImageURLs.forEach(imgURL =>{
        const publicIdAndImgFormat = imgURL.replace(`${process.env.CLOUDINARY_BASE_URL}/`, '');
        restImagesObj[publicIdAndImgFormat] = 1;
    })

    dbImages.forEach(dbImage =>{
        const publicIdAndImgFormat = `${dbImage.public_id}.${dbImage.image_format}`;
        if(restImagesObj[publicIdAndImgFormat]){
            dbOldImages.push(dbImage);
        }else{
            dbOldImagesToDelete.push(dbImage);
        }
    })

    return {dbOldImages, dbOldImagesToDelete};
}
async function deleteImagesFromCloudinary(dbImages){
    const dbImagesPromises = dbImages.map(dbImage => cloudinary.uploader.destroy(dbImage.public_id));
    await Promise.all(dbImagesPromises); 
}

const deleteAllProducts=async ()=>{
    await ProductModel.deleteMany({});
}
const deleteAllUsers=async ()=>{
    await UserModel.deleteMany({});
}

const categories = [
  {
    "category": "Fashion",
    "subcategories": [
      "jeans", "shirts", "t-shirts", "polo shirts", "shorts",
      "jackets", "sweatshirts", "hoodies", "skirts", "dresses",
      "handbags", "watches", "shoes", "socks", "underwear",
      "belts", "scarves", "sunglasses"
    ]
  },
  {
    "category": "Electronics",
    "subcategories": [
      "mobile phones", "laptops", "cameras", "headphones",
      "smartwatches", "smart speakers", "televisions", "tablets",
      "wireless earbuds", "routers", "external hard drives",
      "printers", "monitors", "game consoles"
    ]
  },
  {
    "category": "Home & Kitchen",
    "subcategories": [
      "cookware", "bedding", "sofas", "dining tables",
      "small kitchen appliances", "vacuum cleaners", "wall art",
      "bath towels", "kitchen utensils", "coffee makers",
      "mattresses", "desk chairs"
    ]
  },
  {
    "category": "Beauty & Personal Care",
    "subcategories": [
      "skincare", "lipstick", "perfume", "shampoo",
      "conditioner", "body lotion", "oral care", "makeup brushes",
      "hair coloring", "face serums", "facial cleansers"
    ]
  },
  {
    "category": "Books",
    "subcategories": [
      "fiction", "non-fiction", "children’s books", "textbooks",
      "audiobooks", "ebooks", "comics", "self-help", "cookbooks"
    ]
  },
  {
    "category": "Toys & Games",
    "subcategories": [
      "board games", "puzzles", "action figures", "educational toys",
      "electronic toys", "dolls", "outdoor play", "video games"
    ]
  },
  {
    "category": "Sports & Outdoors",
    "subcategories": [
      "fitness equipment", "camping gear", "cycling",
      "team sports gear", "yoga mats", "running shoes",
      "swimwear", "exercise accessories"
    ]
  },
  {
    "category": "Pet Supplies",
    "subcategories": [
      "dog food", "cat food", "aquatic supplies", "pet grooming tools",
      "pet toys", "pet beds", "bird supplies", "reptile accessories"
    ]
  },
  {
    "category": "Health & Household",
    "subcategories": [
      "vitamins", "supplements", "medical supplies", "cleaning products",
      "personal care essentials", "first aid kits", "nutrition bars"
    ]
  },
  {
    "category": "Tools & Home Improvement",
    "subcategories": [
      "power tools", "hand tools", "hardware", "paint supplies",
      "safety gear", "tool storage", "plumbing tools", "electrical tools"
    ]
  },
  {
    "category": "Industrial & Scientific",
    "subcategories": [
      "lab supplies", "safety equipment", "test & measurement devices",
      "industrial power supplies", "scientific instruments"
    ]
  },
  {
    "category": "Musical Instruments & Video Games",
    "subcategories": [
      "guitars", "keyboards", "drums", "audio interfaces",
      "video games", "game consoles", "PC software"
    ]
  }
]

module.exports = {
    add : async(req, res, next)=>{
        try {
            const {title, description, price, task_type, category, subcategory, latitude, longitude} =  req.body;
            const user = req.user;
            const uploadedFiles = req.files?.files;
            
            //uploading immages
            if (task_type == 'sell' && !uploadedFiles) {
                throw new CustomError(400, 'Product images are required');
            }
            const filesArray = uploadedFiles && (Array.isArray(uploadedFiles) || typeof(uploadedFiles) == 'object')
                ?  Array.isArray(uploadedFiles)  ? uploadedFiles : [uploadedFiles]
                : [];
         
            // const fileDataArray = filesArray.map((file)=>{
            //     const fileOriginalName = String(file.name).toLowerCase();
            //     const fileModifiedName = `${uuidv4()}-${fileOriginalName}`;
            //     const uploadFilePath = path.join(__dirname, '..', '..', '..', 'public', 'uploads', 'products', fileModifiedName);

            //     return new Promise((resolve, reject) =>{
            //         file.mv(uploadFilePath, (err) =>{
            //             if(err) return reject(err);
            //             resolve({
            //                 file_original_name: fileOriginalName,
            //                 file_modified_name: fileModifiedName,
            //             })
            //         })
            //     })
            // })
            // const uploadedImages = await Promise.all(fileDataArray);

            
            const fileDataArray = filesArray.map((file)=>{
                return new Promise((resolve, reject)=>{
                    cloudinary.uploader.upload(file.tempFilePath, {
                        folder: 'uploads/AI-Marketplace/products', // 👈 your desired folder
                    }).then((result)=>{
                        resolve({
                            public_id : result.public_id,
                            image_format : result.secure_url.split('.').at(-1)
                        });
                    }).catch(error =>{
                        reject(error);
                    })
                }) 
            })
            const uploadedImages = await Promise.all(fileDataArray);

            const data = {
                title : title?.toLowerCase() || '',
                description : description?.toLowerCase() || '',
                price : price || 0,
                task_type : task_type?.toString()?.toLowerCase() || 'buy',
                category : category?.toString()?.toLowerCase() || 'other',
                subcategory : subcategory?.toString()?.toLowerCase() || 'other',
                images : uploadedImages,
                created_by : user._id
            }

            //getting embeddings
            const embeddingText = `Title : ${data.title}. Description : ${data.description}. Category : ${data.category}. Subcategory : ${data.subcategory}`;
            // data.embedding = await getEmbedding1536(embeddingText);
            const imageUrls = uploadedImages.map(image =>{
                return `${process.env.CLOUDINARY_BASE_URL}/${image.public_id}.${image.image_format}`
            })
            data.embedding = await embedMultimodal(embeddingText, imageUrls);

            //getting location using coordinates
            const location = await getLocationUsingCoordinates(latitude, longitude);
            location.latitude = latitude || 0;
            location.longitude = longitude || 0;
            location.city = getCityNameUsingLocation(location);
            data.location = location;

            //storing product in DB
            const productCreated = await ProductModel.create(data);

            res
            .status(200)
            .json({success : true, data : productCreated });

        } catch (error) {
            console.log(error);
            next(error);
        }
    },
    edit : async(req, res, next)=>{
        try {
            const {product_id, title, description, price, task_type, category, subcategory, images, latitude, longitude} 
            =  req.body;

            if (!product_id) {
                throw new CustomError(400, 'Product id id required');
            }

            //uploading new images
            const uploadedFiles = req.files?.files;
            if (task_type == 'sell' && !(uploadedFiles || images.length)) {
                throw new CustomError(400, 'Product images are required');
            }
            //deleting old images
            const imagesURL = images ? (typeof(images) == 'string' ? JSON.parse(images) : images) : []
            const task = await ProductModel.findOne({_id: product_id});
            const {dbOldImages, dbOldImagesToDelete} = getDBOldImages(task.images, imagesURL);
            deleteImagesFromCloudinary(dbOldImagesToDelete);

            const filesArray = uploadedFiles && (Array.isArray(uploadedFiles) || typeof(uploadedFiles) == 'object')
                ?  Array.isArray(uploadedFiles)  ? uploadedFiles : [uploadedFiles]
                : [];
         
            const fileDataArray = filesArray.map((file)=>{
                return new Promise((resolve, reject)=>{
                    cloudinary.uploader.upload(file.tempFilePath, {
                        folder: 'uploads/AI-Marketplace/products', // 👈 your desired folder
                    }).then((result)=>{
                        resolve({
                            public_id : result.public_id,
                            image_format : result.secure_url.split('.').at(-1)
                        });
                    }).catch(error =>{
                        reject(error);
                    })
                }) 
            })
            const uploadedImages = [...await Promise.all(fileDataArray), ...dbOldImages];

            const data = {
                title : title?.toLowerCase() || '',
                description : description?.toLowerCase() || '',
                price : price || 0,
                task_type : task_type?.toString()?.toLowerCase() || 'buy',
                category : category?.toString()?.toLowerCase() || 'other',
                subcategory : subcategory?.toString()?.toLowerCase() || 'other',
                images : uploadedImages,
            }

            //getting embeddings
            const embeddingText = `Title : ${data.title}. Description : ${data.description}. Category : ${data.category}. Subcategory : ${data.subcategory}`;
            const embeddingImageUrls = uploadedImages.map(image =>{
                return `${process.env.CLOUDINARY_BASE_URL}/${image.public_id}.${image.image_format}`
            })
            data.embedding = await embedMultimodal(embeddingText, embeddingImageUrls);

            //getting location using coordinates
            if(latitude && longitude){    
                const location = await getLocationUsingCoordinates(latitude, longitude);
                location.latitude = latitude || 0;
                location.longitude = longitude || 0;
                location.city = getCityNameUsingLocation(location);
                data.location = location;
            }

            //updating product in DB
            await ProductModel.updateOne({_id: product_id}, {$set:data});

            res
            .status(200)
            .json({success : true, message: 'Product updated successfully'});
        } catch (error) {
            console.log(error);
            next(error);
        }
    },
    list : async(req, res, next)=>{
        try {
            const user = req.user;
            let {status, sort, skip, limit} = req.body;
            
            console.log(req.body, '=============payload products listing');

            skip = skip || 0;;
            limit = limit || 10;
            if(status && !(status == 'active' || status == 'closed' || status == 'expired')){
                throw new Error('Status is not valid');
            }
            sort = sort ? (typeof(sort)=='string' ? JSON.parse(sort) : sort) : {createdAt: -1};

            let filter = {};

            if(status == 'active' || status == 'expired'){
                filter = {
                    status,
                    created_by : user._id
                }
            }else if(status == 'closed'){
                filter = {
                    status,
                    $or: [
                        {created_by : user._id},
                        {pruchased_by: user._id}
                    ]
                }
            }else{
                filter = {
                    $or:[
                        {created_by : user._id},
                        {pruchased_by: user._id}
                    ]
                    
                }
            }
          
            const productsQuery = ProductModel
                .find(filter)
                .sort(sort)
                .skip(skip)
                .limit(limit)
            const countQuery = ProductModel.countDocuments(filter);
            const [products, count] = await Promise.all([productsQuery, countQuery]);

            const modifiedData = products.map(product =>{
                const plainProduct = product.toJSON();
                delete plainProduct.embedding;
                return {
                    ...plainProduct,
                    images : product?.images.map(image =>{
                        return `${process.env.CLOUDINARY_BASE_URL}/${image.public_id}.${image.image_format}`
                    })
                }
            })

            res
            .status(200)
            .json({success : true, data : {products : modifiedData, count}});
        } catch (error) {
            console.log(error);
            next(error);
        }
    },
    details : async(req, res, next)=>{
        try {
            const product_id =  req.params.product_id;
            if(!product_id){
                throw new CustomError(400, 'Product ID is required');
            }

            const data = await ProductModel.aggregate([
                {
                    $match: {_id : new mongoose.Types.ObjectId(product_id)}
                },
                {
                    $lookup : {
                        from : 'users',
                        let: { user_id: '$created_by' },
                        pipeline: [
                            {
                                $match: { $expr: { $eq: ['$_id', '$$user_id'] } }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    name: 1,
                                    email: 1,
                                    phone: 1
                                }
                            }
                        ],
                        as : 'owner'       
                    }   
                },
                { $unwind : '$owner' },
                {
                    $lookup : {
                        from : 'users',
                        let: { user_id: '$purchased_by' },
                        pipeline: [
                            {
                                $match: { $expr: { $eq: ['$_id', '$$user_id'] } }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    name: 1,
                                    email: 1,
                                    phone: 1
                                }
                            }
                        ],
                        as : 'buyer'       
                    }   
                },
                { $unwind : '$buyer' },
                {
                    $project: {
                        title: 1,
                        description : 1,
                        price: 1,
                        task_type: 1,
                        images: 1,
                        category: 1,
                        subcategory: 1,
                        owner : 1,
                        buyer: 1,
                        location: 1,
                        status: 1,
                        inactive_status: 1,
                        createdAt: 1
                    }
                }
            ]);

            if(!data || !data.length){
                throw new CustomError(400, 'No product found');
            }
            
            const modifiedData = {
                ...data[0],
                images : data[0]?.images.map(image =>{
                    return `${process.env.CLOUDINARY_BASE_URL}/${image.public_id}.${image.image_format}`
                })
            }

            // await deleteAllProducts();
            // await deleteAllUsers();
            res
            .status(200)
            .json({success : true, data : {product : modifiedData}});
        } catch (error) {
            console.log(error);
            next(error);
        }
    },

    getMatchingProducts : async(req, res, next)=>{
        try {
            let {product_id, cursor} = req.body;
            if(!product_id){
                throw new CustomError(400, 'Product ID is required');
            }

            const product = await ProductModel.findOne({_id : product_id});

            const taskTypeToSearch = product.task_type == 'buy' ? 'sell' : 'buy';
            const cityFilter = product.location?.city 
                ? 
                    { 
                        $or:[
                            {'location.city': product.location.city},
                            {'location.city': null}
                        ]
                    } 
                : {}

            // Build a pagination filter if cursor exists
            cursor = cursor ? (typeof(cursor) == 'string' ? JSON.parse(cursor) : cursor ) : null;
            const paginationMatch = cursor
            ? 
                {
                    $or: [
                        { score: { $lt: cursor.last_record_score } },
                        { score: cursor.last_record_score, _id: { $gt: cursor.last_record_id } }
                    ]
                }
            : {};

            const productList = await ProductModel.aggregate([
                {
                    $vectorSearch: {
                        index: "vector_index",
                        path: "embedding",
                        queryVector: product.embedding,
                        filter: { 
                            status: 'active',
                            task_type: taskTypeToSearch, 
                            subcategory : product.subcategory,
                            created_by : {$ne: product.created_by},
                            ...cityFilter
                        },
                        numCandidates: 5000,
                        limit: 500
                    }
                },
                {
                    $lookup : {
                        from : 'users',
                        let: { user_id: '$created_by' },
                        pipeline: [
                            {
                                $match: { $expr: { $eq: ['$_id', '$$user_id'] } }
                            },
                            {
                                $project: {
                                    _id: 1,
                                    name: 1,
                                    email: 1,
                                    phone: 1
                                }
                            }
                        ],
                        as : 'owner'       
                    }
                },
                { $unwind : '$owner' },
                {
                    $project: {
                        score: { $meta: "vectorSearchScore" }, // Convert meta score into a usable field
                        title: 1,
                        description : 1,
                        price: 1,
                        task_type: 1,
                        images: 1,
                        category: 1,
                        subcategory: 1,
                        _id: 1,
                        owner : 1,
                        location: 1,
                        createdAt: 1
                    }
                },
                ...(cursor ? [{ $match: paginationMatch }] : []),
                {
                    $sort: {
                        score: -1, _id: 1, // Primary sort: descending by vector similarity
                    }
                },
                {
                    $limit: 10
                }
            ]);

            let modifiedProducts = productList.map(matchingProduct =>{
                const distanceInMS = getDistanceBetweenCoordinates(
                    matchingProduct.location.latitude, matchingProduct.location.longitude, 
                    product.location.latitude, product.location.longitude
                )
                const distanceInKMS = `${(distanceInMS/1000).toFixed(1)} KMS`;
                return {
                    ...matchingProduct,
                    images : matchingProduct?.images.map(image =>{
                        return `${process.env.CLOUDINARY_BASE_URL}/${image.public_id}.${image.image_format}`
                    }),
                    distance: distanceInKMS
                }
            })

            if(taskTypeToSearch == 'buy'){
                //sorting in DESC
                modifiedProducts = modifiedProducts.sort((productA, productB) => productB.price - productA.price)
            }else{
                //sorting in ASC
                modifiedProducts = modifiedProducts.sort((productA, productB) => productA.price - productB.price)
            }


            res.json({data : modifiedProducts});
        } catch (error) {
            console.log(error);
            next(error);
        }
    },


    getCategories : async(req, res, next)=>{
        try {

            const categoriesList = [];
            categories.forEach(category => categoriesList.push(category.category));

            res
            .status(200)
            .json({success : true, data : {categories: categoriesList}});
        } catch (error) {
            console.log(error);
            next(error);
        }
    },
    getSubCategories : async(req, res, next)=>{
        try {
            const {category_name} = req.query;

            const SubCategoriesList = [];
            const category = categories.find(category => category.category == category_name);

            res
            .status(200)
            .json({success : true, data : {subcategories: category.subcategories}});
        } catch (error) {
            console.log(error);
            next(error);
        }
    },
    
}


