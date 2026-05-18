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
    
    let regex = /\{\s*currency:\s*\{\s*code:\s*'USD',\s*smb:\s*'\$'\s*\},?\s*fontSize:\s*'base',\s*fontFamily:\s*'sans'\s*\}/g;
    
    let newContent = content.replace(regex, "useTheme()");
    
    // Also re-add imports for useTheme
    if (newContent.includes('useTheme()') && !newContent.includes('import { useTheme }')) {
      // Find the last import
      const matches = newContent.match(/^import .*$/gm);
      if (matches) {
          const lastImport = matches[matches.length - 1];
          let relativePath = '../components/ThemeProvider';
          if (filePath.includes('components')) relativePath = './ThemeProvider';
          newContent = newContent.replace(lastImport, lastImport + `\nimport { useTheme } from '${relativePath}';`);
      }
    }
    
    if (content !== newContent) {
      fs.writeFileSync(filePath, newContent, 'utf8');
      console.log('Restored useTheme in', filePath);
    }
  }
});
