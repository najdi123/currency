# PDF Fonts

This directory contains font files converted for use with jsPDF.

## Converting Fonts for jsPDF

To add custom fonts for Persian/Arabic support:

1. Download a TTF font file (e.g., Vazirmatn, Amiri)
2. Go to: https://rawgit.com/MrRio/jsPDF/master/fontconverter/fontconverter.html
3. Upload your TTF file
4. Download the generated JavaScript file
5. Place it in this directory
6. Import it in pdfGenerator.ts

## Recommended Fonts

- **Persian**: Vazirmatn (https://github.com/rastikerdar/vazirmatn)
- **Arabic**: Amiri (https://fonts.google.com/specimen/Amiri)

## Example Usage

```javascript
import './fonts/Vazirmatn-normal.js'

doc.setFont('Vazirmatn')
doc.text('متن فارسی', x, y, { align: 'right' })
```
