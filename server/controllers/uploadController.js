const path = require('path');

const uploadSignature = (req, res) => {
  if (!req.file) {
    return res.status(400).json({ message: 'Signature image is required' });
  }

  return res.status(201).json({
    url: `/uploads/signatures/${req.file.filename}`,
  });
};

const signatureUploadDir = path.join(__dirname, '../storage/uploads/signatures');

module.exports = { uploadSignature, signatureUploadDir };