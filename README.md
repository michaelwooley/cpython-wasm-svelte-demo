# `cpython-wasm-svelte-demo`

Python in the browser (via WebAssembly). A minimal typescript example in a SvelteKit app.

This app is quite similar to the earlier demos in [`ethanhs/python-wasm`](https://github.com/ethanhs/python-wasm) (which has now been ported to the main [`python/cpython` repo in `Tools/wasm`](https://github.com/python/cpython/tree/main/Tools/wasm)).

Relative to that demo, this one removes some complexity (specifically, related to interactions with [xterm.js](https://github.com/xtermjs/xterm.js)) while adding some complexity in the form of:

- Typescript
- Integration into a svelte app rather than vanilla html.

## Developing

To get started:

```bash
# Install
npm i

# Start a dev server @ :3000
npm run dev

# To create a production version of your app:
npm run build

# Preview the production build:
npm run preview
```

# Links

- [`ethanhs/python-wasm`](https://github.com/ethanhs/python-wasm) OG python demo. Still a lot of discussion there re:progress.
- Emscripten
  - Typescript
    - https://github.com/DefinitelyTyped/DefinitelyTyped/blob/master/types/emscripten/index.d.ts
    - https://github.com/imxood/emcc-typescript-example
- `ctypes`/`libffi` work:
  - https://gist.github.com/kleisauke/acfa1c09522705efa5eb0541d2d00887
  - https://github.com/pyodide/pyodide/pull/1656
  - https://github.com/emscripten-core/emscripten/issues/11066
- [`SharedArrayBuffer`: Security requirements](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/SharedArrayBuffer#security_requirements) (mdn)