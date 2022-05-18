#include <stdio.h>
#include <unistd.h>

/**
 * Provides emscripten_set_main_loop_arg and emscripten_cancel_main_loop
 */
#include <emscripten.h>
#include <emscripten/html5.h>

/**
 * A context structure that we can use for passing variables to our loop
 * function, in this case it just contains a single integer
 */
struct context
{
    int x;
};

/**
 * The loop handler, will be called repeatedly
 */
void loop_fn(void *arg)
{
    struct context *ctx = arg;

    printf("x: %d\n", ctx->x);

    if (ctx->x >= 100)
    {
        /**
         * After 101 iterations, stop looping
         */
        emscripten_cancel_main_loop();
        printf("end of loop...\n");
        return;
    }

    ctx->x += 1;
    // usleep(1000000);
    usleep(500000);
}

int gotClick = 0;

// REFERENCE https://github.com/emscripten-core/emscripten/blob/main/tests/test_html5_mouse.c
EM_BOOL mouse_callback(int eventType, const EmscriptenMouseEvent *e, void *userData)
{
    gotClick += 1;
    printf("WASM received click! %d\n", gotClick);

    return 0;
}

const char *beforeunload_callback(int eventType, const void *reserved, void *userData)
{
    printf("Calling before unwind\n");
    emscripten_cancel_main_loop();
    // emscripten_force_exit(0);
    // emscripten_exit_with_live_runtime();
    // __builtin_trap();
    return "";
}

int main()
{
    struct context ctx;
    int simulate_infinite_loop = 1;
    int fps = 10;

    ctx.x = 0;

    EMSCRIPTEN_RESULT ret = emscripten_set_click_callback(EMSCRIPTEN_EVENT_TARGET_WINDOW, 0, 1, mouse_callback);
    emscripten_set_beforeunload_callback(0,
                                         beforeunload_callback);

    // [](int, const void *, void *) -> const char *
    //                                      { emscripten_cancel_main_loop();  emscripten_force_exit(0); });

    emscripten_set_main_loop_arg(loop_fn, &ctx, fps, simulate_infinite_loop);

    /**
     * If simulate_infinite_loop = 0, emscripten_set_main_loop_arg won't block
     * and this code will run straight away.
     * If simulate_infinite_loop = 1 then this code will not be reached
     */
    printf("quitting...\n");
}
