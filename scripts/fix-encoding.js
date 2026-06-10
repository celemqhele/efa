#!/usr/bin/env node

const fs = require('fs');
const path = require('path');

// UTF-8 BOM bytes
const BOM = Buffer.from([0xEF, 0xBB, 0xBF]);

function removeUtf8Bom(filePath) {
  try {
    const content = fs.readFileSync(filePath);
    
    // Check if file starts with BOM
    if (content.length >= 3 && content[0] === 0xEF && content[1] === 0xBB && content[2] === 0xBF) {
      const cleanContent = content.slice(3);
      fs.writeFileSync(filePath, cleanContent);
      console.log(`✓ Fixed BOM in: ${filePath}`);
      return true;
    }
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
  }
  return false;
}

function processDirectory(dir) {
  const extensions = ['.ts', '.tsx', '.js', '.jsx', '.json', '.mjs', '.cjs'];
  let fixedCount = 0;

  const walkDir = (currentPath) => {
    const files = fs.readdirSync(currentPath);
    
    files.forEach(file => {
      const filePath = path.join(currentPath, file);
      const stat = fs.statSync(filePath);

      // Skip node_modules, .next, and hidden directories
      if (stat.isDirectory()) {
        if (!['node_modules', '.next', '.git', 'dist', 'build'].includes(file) && !file.startsWith('.')) {
          walkDir(filePath);
        }
      } else {
        const ext = path.extname(file);
        if (extensions.includes(ext)) {
          if (removeUtf8Bom(filePath)) {
            fixedCount++;
          }
        }
      }
    });
  };

  walkDir(dir);
  console.log(`\n✅ Fixed ${fixedCount} file(s) with UTF-8 BOM`);
}

const targetDir = process.argv[2] || process.cwd();
console.log(`Scanning directory: ${targetDir}`);
processDirectory(targetDir);
