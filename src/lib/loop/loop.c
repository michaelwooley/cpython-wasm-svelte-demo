#include <stdio.h>
#include <unistd.h>

/**
 * Provides emscripten_set_main_loop_arg and emscripten_cancel_main_loop
 */
#include <emscripten.h>

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
    usleep(1000000);

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
}

int main()
{
    struct context ctx;
    int simulate_infinite_loop = 1;
    int fps = 10;

    ctx.x = 0;

    emscripten_set_main_loop_arg(loop_fn, &ctx, fps, simulate_infinite_loop);

    /**
     * If simulate_infinite_loop = 0, emscripten_set_main_loop_arg won't block
     * and this code will run straight away.
     * If simulate_infinite_loop = 1 then this code will not be reached
     */
    printf("quitting...\n");
}
