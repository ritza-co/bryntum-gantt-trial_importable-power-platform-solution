// Merged into the pcf-scripts webpack config (enabled by featureconfig.json).
//
// Power Apps canvas apps and custom pages replace the page's global `Promise` with their own
// WinJS-based implementation (base.js). Promises Bryntum creates with `new Promise(...)` then
// come from WinJS, and its `then` fails inside Bryntum's task editor with
// "this._state.then is not a function" (see forum.bryntum.com/viewtopic.php?t=35643).
//
// Fix: every reference to the `Promise` identifier in this bundle (Bryntum and our code) is
// bound to the browser's native constructor at build time. The host's global is left untouched.
const path    = require('path');
const webpack = require('webpack');

module.exports = {
    plugins : [
        new webpack.ProvidePlugin({
            Promise    : [path.resolve(__dirname, 'BryntumGantt/nativePromise.js'), 'default'],
            // Same idea for `globalThis`: the custom-page wrapper shadows it with a sandbox
            // object, which breaks Bryntum's viewport detection (context menu at top-left).
            globalThis : [path.resolve(__dirname, 'BryntumGantt/realGlobal.js'), 'default']
        })
    ]
};
