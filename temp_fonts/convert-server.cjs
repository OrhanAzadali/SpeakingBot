const fs = require('fs');
const path = require('path');

const pairs = [
    { src: 'NotoSansArabic-Regular.ttf', dst: 'NotoSansArabic.base64.js', varName: 'NotoSansArabicBase64' },
    { src: 'NotoSansHebrew-Regular.ttf', dst: 'NotoSansHebrew.base64.js', varName: 'NotoSansHebrewBase64' },
    { src: 'NotoSansSC-Regular.otf',     dst: 'NotoSansSC.base64.js',     varName: 'NotoSansSCBase64' },
];

const outDir = path.join('..', 'src', 'utils', 'fonts', 'ttf');

if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
}

for (const { src, dst, varName } of pairs) {
    const srcPath = path.join(__dirname, src);
    if (!fs.existsSync(srcPath)) {
        console.error('Missing: ' + srcPath);
        continue;
    }
    const buf = fs.readFileSync(srcPath);
    const b64 = buf.toString('base64');
    const js = '// Auto-generated from ' + src + '\n// ' + buf.length + ' bytes -> ' + b64.length + ' base64 chars\nconst ' + varName + ' = "' + b64 + '";\nexport default ' + varName + ';\n';
    const outPath = path.join(outDir, dst);
    fs.writeFileSync(outPath, js);
    console.log('OK ' + dst + ' -> ' + (b64.length / 1024).toFixed(0) + ' KB');
}

console.log('');
console.log('Done.');
