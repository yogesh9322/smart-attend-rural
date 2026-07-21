const cloudinary = require('cloudinary').v2;
const fs = require('fs');
const path = require('path');

let isCloudinaryConfigured = false;

if (
  process.env.CLOUDINARY_CLOUD_NAME &&
  process.env.CLOUDINARY_API_KEY &&
  process.env.CLOUDINARY_API_SECRET
) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
  });
  isCloudinaryConfigured = true;
  console.log('Cloudinary Configured Successfully');
} else {
  console.log('Cloudinary credentials missing. Student photo uploads will fall back to local disk storage.');
}

/**
 * Uploads a file to Cloudinary or saves it locally
 * @param {String} filePath - Local temporary file path
 * @returns {Promise<Object>} - Object containing url and public_id
 */
const uploadImage = async (filePath) => {
  if (isCloudinaryConfigured) {
    try {
      const result = await cloudinary.uploader.upload(filePath, {
        folder: 'smart_attend_rural',
      });
      // Delete temporary file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
      return {
        url: result.secure_url,
        publicId: result.public_id,
      };
    } catch (error) {
      console.error('Cloudinary Upload Failed, saving locally instead:', error.message);
      if (error.http_code === 403 || error.message.includes('403') || error.message.includes('Forbidden')) {
        console.warn('\n⚠️  [CLOUDINARY CONFIGURATION ERROR]: Cloudinary API returned 403 (Forbidden).');
        console.warn('   This means the credentials in your backend/.env (CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, or CLOUDINARY_API_SECRET) are invalid, expired, or typed incorrectly.');
        console.warn('   Please double-check your Cloudinary dashboard and verify the settings.\n');
      }
    }
  }

  // Local Storage Fallback
  try {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }

    const fileName = path.basename(filePath);
    const destinationPath = path.join(uploadDir, fileName);

    // Copy file to upload directory
    fs.copyFileSync(filePath, destinationPath);

    // Delete temporary file
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }

    // Return a path that can be served statically by Express
    return {
      url: `/uploads/${fileName}`,
      publicId: fileName,
    };
  } catch (error) {
    console.error('Local File Save Failed:', error.message);
    throw new Error('Image Upload Failed');
  }
};

module.exports = {
  uploadImage,
};
