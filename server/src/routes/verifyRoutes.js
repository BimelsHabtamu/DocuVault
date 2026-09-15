const express  = require('express');
const router   = express.Router();
const multer   = require('multer');
const ctrl     = require('../controllers/verifyController');

const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

router.get('/:doc_uuid',       ctrl.verifyByDocUuid);
router.post('/upload',  upload.single('pdf'), ctrl.verifyByUpload);

module.exports = router;
