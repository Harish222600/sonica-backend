const fs = require('fs');
const path = require('path');

const files = ['src/seed.js', 'src/addProducts.js'];

files.forEach(file => {
    const filePath = path.join(__dirname, file);
    if (fs.existsSync(filePath)) {
        let content = fs.readFileSync(filePath, 'utf8');

        // Replace brand in specs
        content = content.replace(/brand: 'SONICA'/g, "brand: 'SS Square'");

        // Replace text descriptions
        content = content.replace(/Sonica Bicycles/g, 'SS Square Industries');
        content = content.replace(/SONICA/g, 'SS Square');
        content = content.replace(/Sonica/g, 'SS Square');

        fs.writeFileSync(filePath, content);
        console.log(`Updated ${file}`);
    } else {
        console.log(`File not found: ${file}`);
    }
});
