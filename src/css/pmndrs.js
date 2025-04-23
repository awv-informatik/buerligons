'use strict'

// Original: https://github.com/dracula/visual-studio-code
// Converted automatically using ./tools/themeFromVsCode
var theme = {
  plain: {
    color: '#e4f0fb',
    backgroundColor: '#252b37'
  },
  styles: [
    {
      types: ['comment', 'prolog', 'doctype', 'cdata'],
      style: {
        color: '#a6accd'
      }
    },
    {
      types: ['deleted'],
      style: {
        color: '#d0679d'
      }
    },
    {
      types: ['punctuation', 'property', 'tag', 'constant', 'symbol'],
      style: {
        color: '#e4f0fb'
      }
    },
    {
      types: ['atrule', 'function', 'class-name', 'boolean', 'number', "selector", "attr-value", "string", "char", "builtin", "inserted"],
      style: {
        color: '#5de4c7'
      }
    },
    {
      types: ['attr-name', 'operator', 'entity', 'url', 'variable'],
      style: {
        color: '#add7ff'
      }
    },
    {
      types: ['keyword'],
      style: {
        color: 'add7ff',
      }
    },
    {
      types: ['regex', 'important'],
      style: {
        color: '#fffac2'
      }
    }
  ]
}

module.exports = theme
