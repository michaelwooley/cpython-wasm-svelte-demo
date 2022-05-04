emcc add.c -o add.emcc.js \
    -s EXPORTED_FUNCTIONS="['_add']" \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME="create_add_module" \
    --post-js add.post.emcc.js