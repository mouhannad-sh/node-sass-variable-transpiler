import { writeFile, readFile, unlink } from 'fs'
const path = require('path')
const isColor = require('is-color')
const { tokenize } = require('scss-tokenizer')
const sass = require('node-sass')

const scss: Promise<{}> = new Promise(done => {
  readFile(path.resolve(__dirname + '/../node_modules/bootstrap/scss/_variables.scss'), 'utf8', (err, data) => {
    if (err) throw err
    done(data)
  })
})

console.log('after')
// const scss: string = `$red: #ff0000;
// $font-fam: "hello world boo", yah ;
// $darkRed: $red - 20;
// $DNRed: darken($red, 20%);
// s {
//     background: $red;
//     background: $darkRed;
//     background: $DNRed;
// }`

interface Variable {
  name: string
  value: string
  isColor: boolean
}

interface State {
  inDefinition: boolean
  inDefinitionValue: boolean
  currentVariableScope: null | string
  variables: Array<Variable>
}

enum LookAhead {
  Token,
  Index
}

enum Token {
  Id,
  Value,
  LineStart,
  ColStart,
  LineEnd,
  ColEnd
}

// console.log(tokenize(scss))
function Processor (tokens) {
  let output: string = ''

  let state: State = {
    inDefinition: false,
    inDefinitionValue: false,
    currentVariableScope: null,
    variables: []
  }
  let idx: number = 0
  while (idx < tokens.length) {
    const token = tokens[idx]
    const id: string = token[0]
    const value: string = token[1]
    const nextToken = tokens[idx + 1]
    const nextId: string | null = nextToken ? nextToken[Token.Id] : null
    const nextValue: string | null = nextToken ? nextToken[Token.Value] : null
    let newVal = value
    if (id === '@') {
      const openingBrace = lookAheadForId('{', idx, tokens)
      const string = lookAheadForId('string', idx, tokens)
      const endOfLine = lookAheadForId(';', idx, tokens)
      const nextIdx = (string && string[1]) || (openingBrace && openingBrace[1]) || (endOfLine && endOfLine[1])
      newVal = getAllInBetween(idx, nextIdx + 1, tokens)
      idx = nextIdx
    } else if (id === 'startInterpolant') {
      const closingBrace = lookAheadForId('string', idx, tokens) || lookAheadForId('word', idx, tokens)
      /**
       * should be getAllInBetween(idx, closingBrace[1] + 1, tokens) +"}"
       * There's a bug in the tokenizer
       */
      newVal = getAllInBetween(idx, closingBrace[1], tokens) + '}'
      console.log('GOT IN', nextValue, newVal)
      idx = closingBrace[1]
    } else if (id === '$') {
      const nextColon = lookAheadForId(':', idx, tokens)
      const endOfLine = lookAheadForId(';', idx, tokens)
      const ident = lookAheadForId('ident', idx, tokens)
      const isDefinition = nextColon && endOfLine[1] > nextColon[1]
      const isUsage = ident && ident[1] && ident[1] === idx + 1
      if (isDefinition) {
        state.inDefinition = true
        let varValue: string = getAllInBetween(nextColon[LookAhead.Index], endOfLine[LookAhead.Index], tokens)
          .slice(1)
          .trim()
        const hasDefault = varValue.includes('!default')
        if (hasDefault) {
          varValue = varValue.replace('!default', '')
        }

        const varName: string = getAllInBetween(idx, nextColon[LookAhead.Index], tokens)
        let colorRef: boolean = false
        // Output Variable and skip index
        newVal = `${varName}:${varValue};\n`

        state.variables = state.variables.concat({
          name: varName,
          value: varValue,
          isColor: isColor(varValue)
        })

        if (state.variables.some(v => varValue.includes(v.name) && !varValue.includes(`#{$${v.name}`))) {
          colorRef = true
        }

        if (isColor(varValue) || colorRef) {
          if (varName === '$custom-checkbox-checked-icon') {
            debugger
          }
          newVal += `${varName}-R:red(${varValue})${hasDefault ? '!default' : ''};\n`
          newVal += `${varName}-G:green(${varValue})${hasDefault ? '!default' : ''};\n`
          newVal += `${varName}-B:blue(${varValue})${hasDefault ? '!default' : ''};\n`
          newVal += `${varName}-H:hue(${varValue})${hasDefault ? '!default' : ''};\n`
          newVal += `${varName}-S:saturation(${varValue})${hasDefault ? '!default' : ''};\n`
          newVal += `${varName}-L:lightness(${varValue})${hasDefault ? '!default' : ''};\n`
          newVal += `${varName}-A:alpha(${varValue})${hasDefault ? '!default' : ''};\n`
        }
        idx = endOfLine[LookAhead.Index]
      } else if (isUsage) {
        const val = ident[LookAhead.Token][Token.Value]
        newVal = `var(--${val}, $${val})`
        idx = ident[LookAhead.Index]
      }
    } else if (state.inDefinitionValue) output += newVal

    idx++
    output += newVal
  }
  // console.log(state.variables)
  return output
}

function lookAheadForId (id: string, start: number, tokens) {
  let finderIndex: number = null
  const targetToken = tokens.find((token, idx) => {
    if (idx > start) {
      if (token[0] == id) {
        finderIndex = idx
        return true
      }
    }
    return false
  })
  if (!finderIndex) return null
  return [targetToken, finderIndex]
}

function getAllInBetween (startIndex, endIndex, tokens): string {
  let o: string = ''
  let inRange: boolean = true

  const sliced = tokens.slice(startIndex, endIndex)
  sliced.forEach(token => {
    o += token[1]
  })
  return o
}

scss.then(scss => {
  // console.log(tokenize(scss))
  console.time('process')
  const processed = Processor(tokenize(scss))
  console.log('=======================================')
  console.timeEnd('process')
  console.time('sass')
  writeFile(path.resolve(__dirname + '/transpiled.scss'), processed, function (err) {})
  const renderedSASS = sass.render(
    {
      data: processed,
      outFile: path.resolve(__dirname + '/out.css')
    },
    function (error, result) {
      // node-style callback from v3.0.0 onwards

      if (!error) {
        // No errors during the compilation, write this result on the disk
        console.log(path.resolve(__dirname + '/out.css'))
        unlink(path.resolve(__dirname + '/error.md'), err => {
          if (err) throw err
          console.log(path.resolve(__dirname + '/error.log') + ' was deleted')
        })
        writeFile(path.resolve(__dirname + '/out.css'), result.css, function (err) {
          console.timeEnd('sass')
          if (!err) {
            // file written on disk
          }
        })
      } else {
        console.log(error)
        writeFile(path.resolve(__dirname + '/error.log'), error.formatted, function (err) {
          console.timeEnd('sass')
          console.log(tokenize('#eee !default'))

          if (!err) {
            // file written on disk
          }
        })
      }
    }
  )
})
