
import {parser} from "./syntax.grammar"
import {LRLanguage, LanguageSupport, indentNodeProp, foldNodeProp, foldInside, delimitedIndent, syntaxTree} from "@codemirror/language"
import {styleTags, tags as t} from "@lezer/highlight"
import { Diagnostic } from "@codemirror/lint";
import { EditorView } from "@codemirror/view";
import {linter} from '@codemirror/lint'

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
      
        VAR: t.variableName,
      
        // Literals
        STRINGLITERAL: t.string,
        
        // Types
        LABEL: t.typeName,
        
        // Keywords
        ISA: t.keyword,
        HAS: t.keyword,
        LINKS: t.keyword,
        OWNS: t.keyword,
        RELATES: t.keyword,
        PLAYS: t.keyword,
      
        // Stages
        MATCH: t.heading1,
        INSERT: t.heading1,
        DELETE: t.heading1,
        UPDATE: t.heading1,
      
        // SubPattern
        OR: t.controlOperator,
        NOT: t.controlOperator,
        TRY: t.controlOperator,
      
        // Misc
        LINECOMMENT: t.lineComment,
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

// A Linter which flags syntax errors from: https://discuss.codemirror.net/t/showing-syntax-errors/3111/6
export function otherExampleLinter() {
  return linter((view: EditorView) => {
    const diagnostics: Diagnostic[] = [];
    syntaxTree(view.state).iterate({
      enter: n => {
        if (n.type.isError) {
          diagnostics.push({
            from: n.from,
            to: n.to,
            severity: "error",
            message: "Syntax error.",
          });
        }
      },
    });
    return diagnostics;
  });
}
