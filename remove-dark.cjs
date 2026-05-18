const fs = require('fs');
const path = require('path');

function walk(dir, callback) {
  fs.readdirSync(dir).forEach(f => {
    let dirPath = path.join(dir, f);
    let isDirectory = fs.statSync(dirPath).isDirectory();
    isDirectory ? walk(dirPath, callback) : callback(path.join(dir, f));
  });
}

walk('./src', function(filePath) {
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts') || filePath.endsWith('.css')) {
    let content = fs.readFileSync(filePath, 'utf8');

    // Remove `dark:class` or `dark:hover:class` or `dark:focus:class` etc.
    let newContent = content.replace(/dark:[^\s'"`]+(?=[\s'"`])/g, '');
    
    // Replace multiple spaces inside class names caused by deletion
    newContent = newContent.replace(/className="([^"]+)"/g, (match, p1) => {
      let cleaned = p1.replace(/\s+/g, ' ').trim();
      return `className="${cleaned}"`;
    });
    newContent = newContent.replace(/className=\{`([^`]+)`\}/g, (match, p1) => {
      let cleaned = p1.replace(/ +/g, ' ').trim();
      return `className={\`${cleaned}\`}`;
    });

    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log('Processed', filePath);
    }
  }
});
