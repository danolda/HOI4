// Oyunu tek dosyalık bir sayfaya paketler: dist/meridyen.html (tam belge) ve dist/meridyen-embed.html (gövde parçası).
import { build } from 'esbuild';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const out = path.join(root, 'dist');
fs.mkdirSync(out, { recursive: true });
const res = await build({ entryPoints: [path.join(root, 'src/main.js')], bundle: true, format: 'iife', minify: true, write: false, target: 'es2020', legalComments: 'none' });
const js = res.outputFiles[0].text.replace(/<\/script/g, '<\\/script');
const css = fs.readFileSync(path.join(root, 'src/style.css'), 'utf8');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const body = html.slice(html.indexOf('<div id="app">'), html.indexOf('<script src='));
const fonts = html.match(/<link rel="stylesheet" href="https:\/\/fonts[^>]+>/)[0];
const three = html.match(/<script src="https:\/\/cdnjs[^>]+><\/script>/g).join('\n');
const embed = `<title>Meridyen Harekâtı</title>
<meta name="claude:viewport-fit-sides" content="cover">
${fonts}
<style>
${css}
</style>
${body}${three}
<script>
document.documentElement.lang = 'tr';
${js}
</script>
`;
fs.writeFileSync(path.join(out, 'meridyen-embed.html'), embed);
fs.writeFileSync(path.join(out, 'meridyen.html'), `<!doctype html>\n<html lang="tr">\n<head>\n<meta charset="utf-8">\n<meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover">\n</head>\n<body>\n${embed}</body>\n</html>\n`);
console.log(`dist/meridyen.html ${(fs.statSync(path.join(out, 'meridyen.html')).size / 1024).toFixed(0)} KB`);
