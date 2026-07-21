const dotenv = require('dotenv');
const cloudinary = require('cloudinary').v2;

dotenv.config({ path: './.env' });

if (!process.env.CLOUDINARY_CLOUD_NAME || !process.env.CLOUDINARY_API_KEY || !process.env.CLOUDINARY_API_SECRET) {
  console.error('Cloudinary env vars missing. Aborting.');
  process.exit(2);
}

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const run = async () => {
  try {
    console.log('Testing Cloudinary credentials by listing a single resource...');
    const res = await cloudinary.api.resources({ max_results: 1 });
    console.log('Cloudinary credentials appear valid. API responded with:', {
      total_count: res.total_count,
      resources: (res.resources || []).length,
    });
    process.exit(0);
  } catch (err) {
    console.error('Cloudinary test failed.');
    if (err && err.http_code) console.error('HTTP Code:', err.http_code);
    if (err && err.message) console.error('Message:', err.message);
    process.exit(1);
  }
};

run();
