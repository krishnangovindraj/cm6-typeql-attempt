
import {basicSetup} from "codemirror"
import {EditorView,  keymap} from "@codemirror/view"
import {TypeQL, otherExampleLinter, typeqlAutocompleteExtension, typeqlSchemaFromText} from "./dist/index.js";
import {defaultKeymap} from "@codemirror/commands"
import {startCompletion} from "@codemirror/autocomplete"

const view = new EditorView({
  doc: "match $x isa person; { $x has name $name; } or { $r links (friend: $x); }; insert $x has name \"Steve\"; end;\n\n" + 
  "define \nrelation friendship sub relationship, relates friend; end;\n\n" + 
  "define \nfun foo($x: integer) -> integer:\n" +
  "match let $y = foo() * ($x + 1);\n" +
  "return first $y;\n" +
  "end;" ,
  parent: document.body,
  extensions: [
    basicSetup,
    TypeQL(),
    typeqlAutocompleteExtension(),
    otherExampleLinter(),
    keymap.of([
      ...defaultKeymap,
      {key: "Alt-Space", run: startCompletion, preventDefault: true},
    ]),
  ]
})


window.typeqlSchemaFromText = typeqlSchemaFromText;