// The browser's own Promise, obtained without naming the global `Promise` (webpack rewrites
// that identifier to this module). An async function always returns a native promise no
// matter what window.Promise has been replaced with.
var NativePromise = (async () => {})().constructor;
module.exports = { default : NativePromise };
