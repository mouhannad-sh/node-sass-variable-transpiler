"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
function isColor(str) {
    return /^(#[0-9a-f]{3}|#(?:[0-9a-f]{2}){2,4}|(rgb|hsl)a?\((-?\d+%?[,\s]+){2,3}\s*[\d.]+%?\))$/gim.test(str);
}
exports.isColor = isColor;
//# sourceMappingURL=isColor.js.map