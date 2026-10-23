#!/usr/bin/env node
// Copies the Bryntum Gantt 7.x stylesheets into the control so the PCF manifest can
// reference them as local <css> resources, and inlines the FontAwesome webfont as a
// data URI so the component makes no external requests (keeps it non-premium).
//
// Run from code/bryntum-gantt-pcf:  npm run copy-css
import { existsSync, readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const pcfDir = resolve(here, '../bryntum-gantt-pcf');
const pkgDir = resolve(pcfDir, 'node_modules/@bryntum/gantt');
const outDir = resolve(pcfDir, 'BryntumGantt/css');
mkdirSync(outDir, { recursive : true });

const version = JSON.parse(readFileSync(resolve(pkgDir, 'package.json'), 'utf8')).version;
console.log(`Bryntum Gantt package version ${version}`);

function stripExternal(css) {
    // No Google Fonts or other remote imports inside a PCF resource.
    return css.replace(/@import\s+url\((["']?)https?:[^)]*\1\)[^;]*;/g, '');
}

// 1. FontAwesome core
writeFileSync(resolve(outDir, 'fontawesome.css'), stripExternal(readFileSync(resolve(pkgDir, 'fontawesome/css/fontawesome.css'), 'utf8')));

// 2. FontAwesome solid, with the woff2 inlined
const woff2 = readFileSync(resolve(pkgDir, 'fontawesome/webfonts/fa-solid-900.woff2')).toString('base64');
let solid = readFileSync(resolve(pkgDir, 'fontawesome/css/solid.css'), 'utf8');
const before = solid;
solid = solid.replace(/src:\s*url\([^;]*;/, `src: url("data:font/woff2;base64,${woff2}") format("woff2");`);
if (solid === before) {
    throw new Error('Could not find the @font-face src in solid.css; the FontAwesome layout changed.');
}
writeFileSync(resolve(outDir, 'solid.css'), stripExternal(solid));

// 3. Structural CSS and the theme. The trial package ships unminified CSS only; use the
//    .min.css files when the licensed package provides them.
function readCss(name) {
    const min = resolve(pkgDir, name.replace(/\.css$/, '.min.css'));
    const plain = resolve(pkgDir, name);
    return readFileSync(existsSync(min) ? min : plain, 'utf8');
}
writeFileSync(resolve(outDir, 'gantt.css'), stripExternal(readCss('gantt.css')));
writeFileSync(resolve(outDir, 'svalbard-light.css'), stripExternal(readCss('svalbard-light.css')));

console.log(`Copied fontawesome.css, solid.css (font inlined, ${Math.round(woff2.length / 1024)} KB base64), gantt.css, svalbard-light.css to ${outDir}`);
