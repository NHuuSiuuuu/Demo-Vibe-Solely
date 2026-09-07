const express = require('express');
const multer = require('multer');
const { asyncHandler } = require('../../utils/asyncHandler');
const { HttpError } = require('../../utils/httpError');
const { searchProductsByImage } = require('../imageSearch/imageSearch.service');
const { listProducts, getProductBySlug } = require('./products.service');

const router = express.Router();
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 8 * 1024 * 1024 } });
const imageUpload = upload.single('image');
const IMAGE_FILTER_FIELDS = ['brand', 'gender', 'size', 'color', 'minPrice', 'maxPrice'];

function uploadImage(req, res, next) {
  imageUpload(req, res, (error) => {
    if (error?.code === 'LIMIT_FILE_SIZE') return next(new HttpError(400, 'Image must not exceed 8 MB'));
    if (error instanceof multer.MulterError) return next(new HttpError(400, 'Invalid image upload'));
    return next(error);
  });
}

router.get(
  '/',
  asyncHandler(async (req, res) => {
    const products = await listProducts(req.query);
    res.json({ products });
  })
);

router.post(
  '/search-by-image',
  uploadImage,
  asyncHandler(async (req, res) => {
    if (!req.file) throw new HttpError(400, 'Image file is required');
    if (!['image/jpeg', 'image/png'].includes(req.file.mimetype)) {
      throw new HttpError(400, 'Image must be JPEG or PNG');
    }

    const filters = Object.fromEntries(
      IMAGE_FILTER_FIELDS.filter((field) => Object.prototype.hasOwnProperty.call(req.body || {}, field))
        .map((field) => [field, req.body[field]])
    );

    try {
      const { products, threshold } = await searchProductsByImage({
        data: req.file.buffer,
        mimeType: req.file.mimetype,
        filters
      });
      res.json({ products, query: { type: 'image' }, threshold });
    } catch (error) {
      if (error.statusCode) throw error;
      throw new HttpError(503, 'Image search is temporarily unavailable');
    }
  })
);

router.get(
  '/:slug',
  asyncHandler(async (req, res) => {
    const product = await getProductBySlug(req.params.slug);
    res.json({ product });
  })
);

module.exports = router;
