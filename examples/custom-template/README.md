# Custom template references

These files are deliberately complete, one-file examples. Copy the closest
shape into `vanillasky/templates/`, rename its ID, then run `npx vanillasky
templates sync` and `npx vanillasky templates check`.

| Reference | Use it when |
| --- | --- |
| [Minimal text](minimal-text.tsx) | One short, grounded idea should fill the scene. |
| [Structured data](structured-data.tsx) | An exact metric and its change are the central proof. |

Both use only `defineTemplate` from the public
`@vanillaskyai/video/templates` entry point. They include selection guidance,
JSON Schema defaults, a named example, deterministic progress-based motion,
safe-zone layout, and portrait/landscape handling. Connect the generated browser
registry through `VideoChat` options and the server registry through
`createVideoChatHandler`, as shown in [Custom templates](../../docs/custom-templates.md).
For media-backed answers, start from a built-in template using
`npx vanillasky templates add media` and configure the handler's `searchMedia`.
