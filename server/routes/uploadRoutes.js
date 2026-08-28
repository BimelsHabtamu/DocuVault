const express = require('express');
const auth = require('../middlewares/authMiddleware');
const { signatureUpload } = require('../middlewares/uploadMiddleware');
const { uploadSignature, signatureUploadDir } = require('../controllers/uploadController');

const router = express.Router();

router.post(
  '/signature',
  auth,
  (req, res, next) => {
    req.signatureUploadDir = signatureUploadDir;
    next();
  },
  signatureUpload.single('file'),
  uploadSignature,
);

module.exports = router;