// The object Bryntum sees as `globalThis`. webpack.config.js rewrites every `globalThis`
// identifier in the bundle to this module's export (ProvidePlugin), so this file must not
// name `globalThis` itself.
//
// Why: Power Apps custom pages and canvas apps evaluate code components inside a wrapper
// scope. Measured on 26 Oct 2026 (bryntum-suite issue 14486):
//   - `window` and `self` resolve to a Power Apps container object, not the real window.
//     Property writes stick on it and it exposes document, getComputedStyle, matchMedia,
//     innerWidth and the other window APIs Bryntum uses.
//   - `globalThis` resolves to the real window while the bundle loads and to the container
//     afterwards. Globals added to the real window during load (Bryntum's `globalThis.bryntum`
//     namespace) are moved into the container and removed from the window.
// Bryntum needs one stable object: it detects the viewport with `constrainTo === globalThis`
// (Rectangle.alignTo) and keeps state on `globalThis.bryntum`. With a moving target, the context
// menu's constrain check failed and the menu opened at the top-left corner. Pinning to the real
// window loses the namespace after load, so the container is the right choice. Outside Power
// Apps `window` is the real window and nothing changes.
function usable(c) {
    try {
        return !!c && !!c.document && typeof c.getComputedStyle === 'function' && typeof c.matchMedia === 'function';
    }
    catch (e) {
        return false;
    }
}

function pick() {
    try { if (typeof window !== 'undefined' && usable(window)) return window; } catch (e) { /* shadowed or absent */ }
    try { if (typeof self !== 'undefined' && usable(self)) return self; } catch (e) { /* shadowed or absent */ }
    try { var w = document.createElement('div').ownerDocument.defaultView; if (usable(w)) return w; } catch (e) { /* no document */ }
    try { var f = Function('return this')(); if (usable(f)) return f; } catch (e) { /* CSP */ }
    return typeof window !== 'undefined' ? window : undefined;
}

module.exports = { default : pick() };
