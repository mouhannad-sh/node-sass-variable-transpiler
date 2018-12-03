"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const fs_1 = require("fs");
const path = require('path');
const isColor = require('is-color');
const { tokenize } = require('scss-tokenizer');
const sass = require('node-sass');
const scss = new Promise(done => {
    fs_1.readFile(path.resolve(__dirname + '/../node_modules/bootstrap/scss/_variables.scss'), 'utf8', (err, data) => {
        if (err)
            throw err;
        done(data);
    });
});
console.log('after');
var LookAhead;
(function (LookAhead) {
    LookAhead[LookAhead["Token"] = 0] = "Token";
    LookAhead[LookAhead["Index"] = 1] = "Index";
})(LookAhead || (LookAhead = {}));
var Token;
(function (Token) {
    Token[Token["Id"] = 0] = "Id";
    Token[Token["Value"] = 1] = "Value";
    Token[Token["LineStart"] = 2] = "LineStart";
    Token[Token["ColStart"] = 3] = "ColStart";
    Token[Token["LineEnd"] = 4] = "LineEnd";
    Token[Token["ColEnd"] = 5] = "ColEnd";
})(Token || (Token = {}));
// console.log(tokenize(scss))
function Processor(tokens) {
    let output = '';
    let state = {
        inDefinition: false,
        inDefinitionValue: false,
        currentVariableScope: null,
        variables: []
    };
    let idx = 0;
    while (idx < tokens.length) {
        const token = tokens[idx];
        const id = token[0];
        const value = token[1];
        const nextToken = tokens[idx + 1];
        const nextId = nextToken ? nextToken[Token.Id] : null;
        const nextValue = nextToken ? nextToken[Token.Value] : null;
        let newVal = value;
        if (id === '@') {
            const openingBrace = lookAheadForId('{', idx, tokens);
            const string = lookAheadForId('string', idx, tokens);
            const endOfLine = lookAheadForId(';', idx, tokens);
            const nextIdx = (string && string[1]) || (openingBrace && openingBrace[1]) || (endOfLine && endOfLine[1]);
            newVal = getAllInBetween(idx, nextIdx + 1, tokens);
            idx = nextIdx;
        }
        else if (id === 'startInterpolant') {
            const closingBrace = lookAheadForId('string', idx, tokens) || lookAheadForId('word', idx, tokens);
            /**
             * should be getAllInBetween(idx, closingBrace[1] + 1, tokens) +"}"
             * There's a bug in the tokenizer
             */
            newVal = getAllInBetween(idx, closingBrace[1], tokens) + '}';
            console.log('GOT IN', nextValue, newVal);
            idx = closingBrace[1];
        }
        else if (id === '$') {
            const nextColon = lookAheadForId(':', idx, tokens);
            const endOfLine = lookAheadForId(';', idx, tokens);
            const ident = lookAheadForId('ident', idx, tokens);
            const isDefinition = nextColon && endOfLine[1] > nextColon[1];
            const isUsage = ident && ident[1] && ident[1] === idx + 1;
            if (isDefinition) {
                state.inDefinition = true;
                let varValue = getAllInBetween(nextColon[LookAhead.Index], endOfLine[LookAhead.Index], tokens)
                    .slice(1)
                    .trim();
                const hasDefault = varValue.includes('!default');
                if (hasDefault) {
                    varValue = varValue.replace('!default', '');
                }
                const varName = getAllInBetween(idx, nextColon[LookAhead.Index], tokens);
                let colorRef = false;
                // Output Variable and skip index
                newVal = `${varName}:${varValue};\n`;
                state.variables = state.variables.concat({
                    name: varName,
                    value: varValue,
                    isColor: isColor(varValue)
                });
                if (state.variables.some(v => varValue.includes(v.name) && !varValue.includes(`#{$${v.name}`))) {
                    colorRef = true;
                }
                if (isColor(varValue) || colorRef) {
                    if (varName === '$custom-checkbox-checked-icon') {
                        debugger;
                    }
                    newVal += `${varName}-R:red(${varValue})${hasDefault ? '!default' : ''};\n`;
                    newVal += `${varName}-G:green(${varValue})${hasDefault ? '!default' : ''};\n`;
                    newVal += `${varName}-B:blue(${varValue})${hasDefault ? '!default' : ''};\n`;
                    newVal += `${varName}-H:hue(${varValue})${hasDefault ? '!default' : ''};\n`;
                    newVal += `${varName}-S:saturation(${varValue})${hasDefault ? '!default' : ''};\n`;
                    newVal += `${varName}-L:lightness(${varValue})${hasDefault ? '!default' : ''};\n`;
                    newVal += `${varName}-A:alpha(${varValue})${hasDefault ? '!default' : ''};\n`;
                }
                idx = endOfLine[LookAhead.Index];
            }
            else if (isUsage) {
                const val = ident[LookAhead.Token][Token.Value];
                newVal = `var(--${val}, $${val})`;
                idx = ident[LookAhead.Index];
            }
        }
        else if (state.inDefinitionValue)
            output += newVal;
        idx++;
        output += newVal;
    }
    // console.log(state.variables)
    return output;
}
function lookAheadForId(id, start, tokens) {
    let finderIndex = null;
    const targetToken = tokens.find((token, idx) => {
        if (idx > start) {
            if (token[0] == id) {
                finderIndex = idx;
                return true;
            }
        }
        return false;
    });
    if (!finderIndex)
        return null;
    return [targetToken, finderIndex];
}
function getAllInBetween(startIndex, endIndex, tokens) {
    let o = '';
    let inRange = true;
    const sliced = tokens.slice(startIndex, endIndex);
    sliced.forEach(token => {
        o += token[1];
    });
    return o;
}
scss.then(scss => {
    // console.log(tokenize(scss))
    console.time('process');
    const processed = Processor(tokenize(scss));
    console.log('=======================================');
    console.timeEnd('process');
    console.time('sass');
    fs_1.writeFile(path.resolve(__dirname + '/transpiled.scss'), processed, function (err) { });
    const renderedSASS = sass.render({
        data: processed,
        outFile: path.resolve(__dirname + '/out.css')
    }, function (error, result) {
        // node-style callback from v3.0.0 onwards
        if (!error) {
            // No errors during the compilation, write this result on the disk
            console.log(path.resolve(__dirname + '/out.css'));
            fs_1.unlink(path.resolve(__dirname + '/error.md'), err => {
                if (err)
                    throw err;
                console.log(path.resolve(__dirname + '/error.log') + ' was deleted');
            });
            fs_1.writeFile(path.resolve(__dirname + '/out.css'), result.css, function (err) {
                console.timeEnd('sass');
                if (!err) {
                    // file written on disk
                }
            });
        }
        else {
            console.log(error);
            fs_1.writeFile(path.resolve(__dirname + '/error.log'), error.formatted, function (err) {
                console.timeEnd('sass');
                console.log(tokenize('#eee !default'));
                if (!err) {
                    // file written on disk
                }
            });
        }
    });
});
//# sourceMappingURL=index.js.map