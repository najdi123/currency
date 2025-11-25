/**
 * Font Converter Script for jsPDF
 *
 * This script helps you convert TTF fonts for use with jsPDF.
 *
 * MANUAL STEPS REQUIRED:
 *
 * 1. Download fonts:
 *    - Persian: https://github.com/rastikerdar/vazirmatn/releases (download Vazirmatn-Regular.ttf)
 *    - Arabic: https://fonts.google.com/specimen/Amiri (download Amiri-Regular.ttf)
 *
 * 2. Convert fonts using online converter:
 *    - Go to: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
 *    - Upload each TTF file
 *    - Click "Create"
 *    - Download the generated .js file
 *
 * 3. Place generated files in: apps/frontend/src/lib/utils/fonts/
 *    - Rename to: Vazirmatn-normal.js and Amiri-normal.js
 *
 * 4. The pdfGenerator.ts will automatically use these fonts when available
 */

const fs = require('fs')
const path = require('path')
const https = require('https')

const FONTS_DIR = path.join(__dirname, '../apps/frontend/src/lib/utils/fonts')

// Create fonts directory if it doesn't exist
if (!fs.existsSync(FONTS_DIR)) {
  fs.mkdirSync(FONTS_DIR, { recursive: true })
}

console.log('📁 Fonts directory ready:', FONTS_DIR)
console.log('\n⚠️  MANUAL STEPS REQUIRED:')
console.log('\n1. Download fonts:')
console.log('   Persian: https://github.com/rastikerdar/vazirmatn/releases')
console.log('   Arabic: https://fonts.google.com/specimen/Amiri')
console.log('\n2. Convert using: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html')
console.log(`\n3. Place .js files in: ${FONTS_DIR}`)
console.log('   - Vazirmatn-normal.js')
console.log('   - Amiri-normal.js')
console.log('\n✅ Once fonts are added, the PDF generator will work with Persian/Arabic text!')
