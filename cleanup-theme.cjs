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
  if (filePath.endsWith('.tsx') || filePath.endsWith('.ts')) {
    let content = fs.readFileSync(filePath, 'utf8');
    
    // Remove import
    let newContent = content.replace(/import\s+\{\s*useTheme\s*\}\s+from\s+['"\.]+\/components\/ThemeProvider['"];\n?/g, '');
    newContent = newContent.replace(/import\s+\{\s*useTheme\s*\}\s+from\s+['"\.]+\/ThemeProvider['"];\n?/g, '');
    
    // Remove useTheme calls
    newContent = newContent.replace(/const\s+\{\s*theme\s*\}\s*=\s*useTheme\(\);\n?/g, '');
    newContent = newContent.replace(/const\s+\{\s*theme,\s*toggleTheme\s*\}\s*=\s*useTheme\(\);\n?/g, '');
    
    // Sometimes it's mixed with other things
    newContent = newContent.replace(/const\s+\{[^}]*theme[^}]*\}\s*=\s*useTheme\(\);\n?/g, '');
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log('Cleaned up', filePath);
    }
  }
});
