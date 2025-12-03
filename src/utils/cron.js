const cron = require('node-cron');

const productsModel = require('../models/products');

cron.schedule('0 0 * * *', async()=>{

    const currentDate = new Date();
    currentDate.setDate(currentDate.getDate() - 60);
    const taskCreationDate = currentDate;

    await productsModel.updateMany({
        status: 'active',
        createdAt: { $lt: taskCreationDate}
    },{
        status: 'expired'
    })
})