const multer = require('multer');
const path = require('path');
const fs = require('fs');

// Ensure temporary upload directory exists
const tempDir = path.join(__dirname, '../uploads/temp');
if (!fs.existsSync(tempDir)) {
  fs.mkdirSync(tempDir, { recursive: true });
}

// Storage Configuration
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, tempDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
    cb(null, `${file.fieldname}-${uniqueSuffix}${path.extname(file.originalname)}`);
  },
});

// File Filter
const fileFilter = (req, file, cb) => {
  const filetypes = /jpeg|jpg|png|webp|pdf|doc|docx|xls|xlsx|txt|ppt|pptx/;
  const extname = filetypes.test(path.extname(file.originalname).toLowerCase());
  const mimetype = filetypes.test(file.mimetype) || file.originalname.toLowerCase().match(/\.(pdf|doc|docx|xls|xlsx|txt|ppt|pptx)$/);

  if (mimetype && extname) {
    return cb(null, true);
  } else {
    cb(new Error('Only images and document files (.jpg, .png, .pdf, .docx, .xlsx) are allowed!'));
  }
};

const upload = multer({
  storage,
  limits: { fileSize: 3 * 1024 * 1024 }, // 3MB Limit
  fileFilter,
});

module.exports = upload;
