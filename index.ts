
import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {TypeQL, otherExampleLinter} from "./dist/index.js";

const view = new EditorView({
  doc: "match $x isa person; { $x has name $name; } or { $r links (friend: $x); }; end;\n\n" + 
  "define \nrelation friendship sub relationship, relates friend; end;\n\n" + 
  "define \nfun foo($x: integer) -> integer:\n" +
  "match let $y = foo() * ($x + 1);\n" +
  "return first $y;\n" +
  "end;" ,
  parent: document.body,
  extensions: [basicSetup, TypeQL(), otherExampleLinter()]
})
