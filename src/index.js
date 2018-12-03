var __assign = (this && this.__assign) || function () {
    __assign = Object.assign || function(t) {
        for (var s, i = 1, n = arguments.length; i < n; i++) {
            s = arguments[i];
            for (var p in s) if (Object.prototype.hasOwnProperty.call(s, p))
                t[p] = s[p];
        }
        return t;
    };
    return __assign.apply(this, arguments);
};
var tokenize = require("scss-tokenizer").tokenize;
var scss = "$red: #ff000;\n$font-fam: \"hello world boo\", yah ;\ns {\n    background: $red;\n}";
// console.log(tokenize(scss))
function Processor(tokens) {
    var output = "";
    var step = 0;
    var inVar = false;
    var state = {
        inDefinition: false,
        inDefinitionValue: false,
        currentVariableScope: null,
        variables: []
    };
    var idx = 0;
    while (idx < tokens.length) {
        var token = tokens[idx];
        var id = token[0];
        var value = token[1];
        var newVal = value;
        if (id === "$") {
            var isDefinition = lookAheadForId(":", idx, tokens);
            if (isDefinition) {
                state.inDefinition = true;
            }
        }
        else if (state.inDefinition || state.inDefinitionValue) {
            switch (id) {
                case "ident":
                    if (!state.inDefinitionValue) {
                        state = __assign({}, state, { variables: state.variables.concat({ name: value, value: "" }), currentVariableScope: value });
                    }
                    break;
                case ":":
                    state.inDefinition = false;
                    state.inDefinitionValue = true;
                    break;
                case ";":
                    //   console.log(";")
                    state.inDefinition = false;
                    state.inDefinitionValue = false;
                    break;
                default:
                    if (state.inDefinitionValue) {
                        var vs = state.variables;
                        var variable = vs.find(function (v) { return state.currentVariableScope === v.name; });
                        variable.value += value;
                    }
                    break;
            }
        }
        else if (state.inDefinitionValue)
            output += newVal;
    }
    return output;
}
function lookAheadForId(id, start, tokens) {
    var boundA = tokens.slice(start);
    var boundB = boundA.findIndex(function (token) { return token[0] === ";"; });
    var sliced = boundA.slice(0, boundB);
    return sliced.find(function (i) { return i[0] == id; });
}
console.log(Processor(tokenize(scss)));
