import {parser} from "./syntax.grammar"
import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"

export const TypeQLLanguage = LRLanguage.define({
  parser: parser.configure({
    props: [
      indentNodeProp.add({
        QueryStage: delimitedIndent({closing: ")", align: false})
      }),
      foldNodeProp.add({
        QueryStage: foldInside
      }),
      styleTags({
        Var: t.variableName,
        StringLiteral: t.string,
        LineComment: t.lineComment,
        "( )": t.paren
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
