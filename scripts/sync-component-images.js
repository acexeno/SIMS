import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

// Get current directory for ES modules
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration (paths relative to project root)
const rootDir = path.resolve(__dirname, '..');
const sourceDir = path.join(rootDir, 'PCAssemblyimages');
const targetDir = path.join(rootDir, 'public', 'images', 'components');

// Category mapping from your folder names to the expected structure
const categoryMapping = {
  'CPU': 'cpu',
  'GPU': 'gpu', 
  'RAM': 'ram',
  'MOTHERBOARD': 'motherboard',
  'STORAGE': 'storage',
  'POWERSUPPLY': 'psu',
  'PCCASE': 'case',
  'COOLING': 'cooler'
};

// Component name mapping for exact matches
const componentNameMapping = {
  // CPU mappings
  'R3 3200G (TRAY) WITH HEATSINK FAN.png': 'R3 3200G (TRAY) WITH HEATSINK FAN',
  'R5 5600G (TRAY) WITH HEATSINK FAN.png': 'R5 5600G (TRAY) WITH HEATSINK FAN',
  'R5 5600GT (TRAY) WITH HEATSINK FAN.png': 'R5 5600GT (TRAY) WITH HEATSINK FAN',
  'R5 5600X (TRAY) WITH HEATSINK FAN.png': 'R5 5600X (TRAY) WITH HEATSINK FAN',
  'R5 7600X (TRAY) WITH HEATSINK FAN.png': 'R5 7600X (TRAY) WITH HEATSINK FAN',
  'R7 5700G (TRAY) WITH HEATSINK FAN.png': 'R7 5700G (TRAY) WITH HEATSINK FAN',
  'R7 5700X (TRAY) WITH HEATSINK FAN.png': 'R7 5700X (TRAY) WITH HEATSINK FAN',
  'R7 5800X (TRAY) WITH HEATSINK FAN.png': 'R7 5800X (TRAY) WITH HEATSINK FAN',
  
  // GPU mappings
  'GIGABYTE RX 6600 8GB EAGLE.png': 'AMD RX 6600',
  'GIGABYTE RTX 4060 AERO OC 8GB WHITE.png': 'NVIDIA RTX 4060',
  'GALAX RTX 3060 1-CLICK OC BLK 12GB.png': 'NVIDIA RTX 3060',
  
  // RAM mappings
  'KINGSTON FURY BEAST DDR4 8GB.png': 'Kingston FURY BEAST DDR4 8GB',
  'KINGSTON FURY BEAST DDR4 16GB (single stick).png': 'Kingston FURY BEAST DDR4 16GB',
  'TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK.png': 'T-Force Delta RGB DDR4 16GB',
  
  // Add more mappings as needed
};

// Function to create directory if it doesn't exist
function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
    console.log(`Created directory: ${dir}`);
  }
}

// Function to copy file
function copyFile(source, target) {
  try {
    fs.copyFileSync(source, target);
    console.log(`Copied: ${path.basename(source)} -> ${target}`);
    return true;
  } catch (error) {
    console.error(`Error copying ${source}:`, error.message);
    return false;
  }
}

// Function to generate component name from filename
function generateComponentName(filename, category) {
  // Remove file extension
  const nameWithoutExt = filename.replace(/\.(png|jpg|jpeg)$/i, '');
  
  // Check if we have an exact mapping
  if (componentNameMapping[filename]) {
    return componentNameMapping[filename];
  }
  
  // Try to extract meaningful name
  let componentName = nameWithoutExt;
  
  // Clean up common patterns
  componentName = componentName
    .replace(/\(TRAY\)/gi, '(TRAY)')
    .replace(/\(BOX\)/gi, '(BOX)')
    .replace(/WITH HEATSINK FAN/gi, 'WITH HEATSINK FAN')
    .replace(/kit \(2x\d+gb\)/gi, 'kit')
    .replace(/single stick/gi, '')
    .replace(/WHITE/gi, 'WHITE')
    .replace(/BLACK/gi, 'BLACK')
    .replace(/RGB/gi, 'RGB')
    .replace(/DDR4/gi, 'DDR4')
    .replace(/DDR5/gi, 'DDR5')
    .replace(/GB/gi, 'GB')
    .replace(/MB/gi, 'MB')
    .replace(/MHz/gi, 'MHz')
    .replace(/OC/gi, 'OC')
    .replace(/GAMING/gi, 'GAMING')
    .replace(/EAGLE/gi, 'EAGLE')
    .replace(/AERO/gi, 'AERO')
    .replace(/PULSE/gi, 'PULSE')
    .replace(/CHALLENGER/gi, 'CHALLENGER')
    .replace(/BATTLE AX/gi, 'BATTLE AX')
    .replace(/1-CLICK/gi, '1-CLICK')
    .replace(/EX PLUS/gi, 'EX PLUS')
    .replace(/ULTRA/gi, 'ULTRA')
    .replace(/IGAME/gi, 'IGAME')
    .replace(/GEFORCE/gi, 'GEFORCE')
    .replace(/RADEON/gi, 'RADEON')
    .replace(/RTX/gi, 'RTX')
    .replace(/GTX/gi, 'GTX')
    .replace(/RX/gi, 'RX')
    .replace(/AMD/gi, 'AMD')
    .replace(/NVIDIA/gi, 'NVIDIA')
    .replace(/GIGABYTE/gi, 'GIGABYTE')
    .replace(/GALAX/gi, 'GALAX')
    .replace(/COLORFUL/gi, 'COLORFUL')
    .replace(/ASROCK/gi, 'ASROCK')
    .replace(/SAPPHIRE/gi, 'SAPPHIRE')
    .replace(/RAMSTA/gi, 'RAMSTA')
    .replace(/PNY/gi, 'PNY')
    .replace(/KINGSTON/gi, 'Kingston')
    .replace(/TFORCE/gi, 'T-Force')
    .replace(/TEAM/gi, 'Team')
    .replace(/SKIHOTAR/gi, 'SKIHOTAR')
    .replace(/NEO FORZA/gi, 'Neo Forza')
    .replace(/KINGSPEC/gi, 'KINGSPEC')
    .replace(/ATHLON/gi, 'Athlon')
    .replace(/i\d+-\d+/gi, (match) => match.toUpperCase())
    .replace(/R\d+/gi, (match) => match.toUpperCase());
  
  return componentName.trim();
}

// Function to generate image path
function generateImagePath(filename, category) {
  const cleanName = filename.toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
  
  return `/images/components/${category}/${cleanName}`;
}

// Function to sync images
function syncImages() {
  console.log('🚀 Starting component image sync...\n');
  
  // Ensure target directory exists
  ensureDir(targetDir);
  
  let totalCopied = 0;
  let totalSkipped = 0;
  const componentMappings = {};
  
  // Process each category
  Object.entries(categoryMapping).forEach(([sourceCategory, targetCategory]) => {
    const sourceCategoryPath = path.join(sourceDir, sourceCategory);
    const targetCategoryPath = path.join(targetDir, targetCategory);
    
    if (!fs.existsSync(sourceCategoryPath)) {
      console.log(`⚠️  Source category not found: ${sourceCategoryPath}`);
      return;
    }
    
    // Create target category directory
    ensureDir(targetCategoryPath);
    
    console.log(`📁 Processing ${sourceCategory} -> ${targetCategory}...`);
    
    // Get all files in the source category
    const files = fs.readdirSync(sourceCategoryPath).filter(file => 
      /\.(png|jpg|jpeg)$/i.test(file)
    );
    
    files.forEach(file => {
      const sourcePath = path.join(sourceCategoryPath, file);
      const targetPath = path.join(targetCategoryPath, file);
      
      // Copy the file
      if (copyFile(sourcePath, targetPath)) {
        totalCopied++;
        
        // Generate component name and mapping
        const componentName = generateComponentName(file, targetCategory);
        const imagePath = generateImagePath(file, targetCategory);
        
        // Store mapping for componentImages.js update
        componentMappings[componentName] = imagePath;
      } else {
        totalSkipped++;
      }
    });
    
    console.log(`✅ ${files.length} files processed for ${targetCategory}\n`);
  });
  
  console.log(`📊 Sync Summary:`);
  console.log(`   ✅ Copied: ${totalCopied} files`);
  console.log(`   ⚠️  Skipped: ${totalSkipped} files`);
  
  // Update componentImages.js
  updateComponentImagesFile(componentMappings);
  
  console.log('\n🎉 Component image sync completed!');
}

// Function to update componentImages.js
function updateComponentImagesFile(componentMappings) {
  const componentImagesPath = path.join(rootDir, 'src', 'utils', 'componentImages.js');
  
  if (!fs.existsSync(componentImagesPath)) {
    console.log('⚠️  componentImages.js not found, skipping update');
    return;
  }
  
  try {
    let content = fs.readFileSync(componentImagesPath, 'utf8');
    
    // Find the componentImages object
    const startMarker = 'const componentImages = {';
    const endMarker = '};';
    
    const startIndex = content.indexOf(startMarker);
    const endIndex = content.indexOf(endMarker, startIndex);
    
    if (startIndex === -1 || endIndex === -1) {
      console.log('⚠️  Could not find componentImages object in file');
      return;
    }
    
    // Generate new componentImages content
    let newComponentImages = 'const componentImages = {\n';
    
    // Add existing mappings (keep the ones that are already there)
    const existingContent = content.substring(startIndex + startMarker.length, endIndex);
    if (existingContent.trim()) {
      newComponentImages += existingContent.trim() + '\n';
    }
    
    // Add new mappings
    Object.entries(componentMappings).forEach(([componentName, imagePath]) => {
      newComponentImages += `  "${componentName}": "${imagePath}",\n`;
    });
    
    newComponentImages += '};';
    
    // Replace the componentImages object
    const beforeComponentImages = content.substring(0, startIndex);
    const afterComponentImages = content.substring(endIndex + endMarker.length);
    
    const newContent = beforeComponentImages + newComponentImages + afterComponentImages;
    
    // Write the updated file
    fs.writeFileSync(componentImagesPath, newContent, 'utf8');
    
    console.log(`✅ Updated ${componentImagesPath} with ${Object.keys(componentMappings).length} new mappings`);
    
  } catch (error) {
    console.error('❌ Error updating componentImages.js:', error.message);
  }
}

// Function to create a backup
function createBackup() {
  const backupDir = path.join(rootDir, 'backup-component-images-' + new Date().toISOString().slice(0, 19).replace(/:/g, '-'));
  
  if (fs.existsSync(targetDir)) {
    try {
      fs.cpSync(targetDir, backupDir, { recursive: true });
      console.log(`📦 Created backup: ${backupDir}`);
    } catch (error) {
      console.log('⚠️  Could not create backup:', error.message);
    }
  }
}

// Main execution
console.log('🔄 Component Image Sync Tool');
console.log('============================\n');

// Check if source directory exists
if (!fs.existsSync(sourceDir)) {
  console.error(`❌ Source directory not found: ${sourceDir}`);
  console.log('Please make sure the PCAssemblyimages folder exists in the project root.');
  process.exit(1);
}

// Create backup
createBackup();

// Sync images
syncImages();

console.log('\n📝 Next steps:');
console.log('1. Test your PC Assembly page to see the new images');
console.log('2. Check browser console for any image loading errors');
console.log('3. Update component names in componentImages.js if needed');
console.log('4. Remove the backup folder if everything works correctly');
