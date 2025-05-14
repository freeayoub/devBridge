const fs = require('fs');
const path = require('path');
const https = require('https');

// Create uploads directory if it doesn't exist
const uploadsDir = path.join(__dirname, '..', 'uploads');
if (!fs.existsSync(uploadsDir)) {
  fs.mkdirSync(uploadsDir, { recursive: true });
  console.log('Created uploads directory');
}

// URL for a simple default avatar
const defaultAvatarUrl = 'https://cdn.pixabay.com/photo/2015/10/05/22/37/blank-profile-picture-973460_1280.png';
const outputPath = path.join(uploadsDir, 'default-avatar.png');

// Download the image
console.log(`Downloading default avatar from ${defaultAvatarUrl}`);
const file = fs.createWriteStream(outputPath);

https.get(defaultAvatarUrl, (response) => {
  response.pipe(file);
  
  file.on('finish', () => {
    file.close();
    console.log(`Default avatar downloaded to ${outputPath}`);
  });
}).on('error', (err) => {
  fs.unlink(outputPath, () => {}); // Delete the file if there's an error
  console.error(`Error downloading default avatar: ${err.message}`);
});
