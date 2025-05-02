
import {basicSetup} from "codemirror"
import {EditorView} from "@codemirror/view"
import {TypeQL, otherExampleLinter} from "./dist/index.js";

const view = new EditorView({
  doc: "match $x isa person; { $x has name $name; } or { $r links (friend: $x); };",
  parent: document.body,
  extensions: [basicSetup, TypeQL(), otherExampleLinter()]
})
