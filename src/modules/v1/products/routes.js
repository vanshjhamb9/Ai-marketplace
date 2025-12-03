const express = require('express');
const router = express.Router();

const controller = require('./controller');

router.post('/add', controller.add);
router.post('/edit', controller.edit);
router.post('/list', controller.list);
router.get('/details/:product_id', controller.details);
router.post('/get-matching-products', controller.getMatchingProducts);

router.get('/get-categories', controller.getCategories);
router.get('/get-subcategories', controller.getSubCategories);
module.exports = router;