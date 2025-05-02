
import {parser} from "./syntax.grammar"
import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

export const TypeQLLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        
      }),
      foldNodeProp.add({
        QueryStage: foldInside
      }),
      styleTags({
        // See: https://lezer.codemirror.net/docs/ref/#highlight.tags

        Var: t.variableName,

        // Literals
        StringLiteral: t.string,
        
        
        // Types
        Label: t.typeName,
        
        // Keywords
        Isa: t.keyword,
        Has: t.keyword,
        Links: t.keyword,

        // Stages
        Match: t.heading1,
        
        // // SubPattern
        // Or: t.controlOperator,
        // Not: t.controlOperator,
        // Try: t.controlOperator,

        // Misc
        LineComment: t.lineComment,
      })
    ]
  }),
  languageData: {
    commentTokens: {line: "#"}
  }
})

export function TypeQL() {
  return new LanguageSupport(TypeQLLanguage)
}
