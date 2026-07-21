const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;

dotenv.config({ path: './.env' });

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const tinyPngDataUri = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR4nGNgYAAAAAMAASsJTYQAAAAASUVORK5CYII=';

const run = async () => {
  try {
    console.log('Attempting to upload a tiny PNG to Cloudinary...');
    const res = await cloudinary.uploader.upload(tinyPngDataUri, { folder: 'smart_attend_rural_test' });
    console.log('Upload succeeded:', { url: res.secure_url, public_id: res.public_id });
    process.exit(0);
  } catch (err) {
    console.error('Upload failed.');
    if (err && err.http_code) console.error('HTTP Code:', err.http_code);
    if (err && err.message) console.error('Message:', err.message);
    if (err && err.request && err.request.body) console.error('Request body length:', err.request.body.length);
    process.exit(1);
  }
};

run();
