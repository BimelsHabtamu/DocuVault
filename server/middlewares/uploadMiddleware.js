const multer = require('multer');

const imageStorage = multer.diskStorage({
	destination: (req, file, callback) => {
		callback(null, req.signatureUploadDir);
	},
	filename: (req, file, callback) => {
		const extension = file.mimetype.split('/')[1] || 'png';
		callback(null, `signature-${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${extension}`);
	},
});

const signatureUpload = multer({
	storage: imageStorage,
	limits: { fileSize: 2 * 1024 * 1024 },
	fileFilter: (req, file, callback) => {
		if (file.mimetype.startsWith('image/')) {
			callback(null, true);
			return;
		}
		callback(new Error('Only image files are allowed'));
	},
});

module.exports = { signatureUpload };
