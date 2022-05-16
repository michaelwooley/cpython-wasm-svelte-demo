# emcc add.c -o add.emcc.js \
    # -s EXPORTED_FUNCTIONS="['_add']" \
    # -s MODULARIZE=1 \
    # -s EXPORT_ES6=1 \
    # -s EXPORT_NAME="create_add_module" \
    # --post-js add.post.emcc.js


emcc add.c \
-o add.emcc.js \
    -o add.emcc.html \
    -pthread \
    --post-js add.post.emcc.js \
    -sPTHREAD_POOL_SIZE=2 \
    -sPROXY_TO_PTHREAD

emcc add.c \
    -o add.emcc.js \
    -pthread \
    -sPTHREAD_POOL_SIZE=2 \
    -sPROXY_TO_PTHREAD \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s EXPORT_NAME="create_add_module" \
    --post-js add.post.emcc.js \
    -sENVIRONMENT=web,worker
