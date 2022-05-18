#include <stdio.h>
#include <unistd.h>

/**
 * Provides emscripten_set_main_loop_arg and emscripten_cancel_main_loop
 */
#include <pthread.h>
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
    usleep(1000000);
    // usleep(500000);
}

int async_call_trial_count = 0;
void async_call_trial(void *arg)
{
    async_call_trial_count += 1;

    printf("async_call_trial: %d\n", async_call_trial_count);
    if (async_call_trial_count > 100)
    {
        return;
    }
    emscripten_async_call(async_call_trial, 0, 10);
}

void *sidecar_thread(void *arg)
{
    int i = 0;
    while (i < 500)
    {
        // EM_ASM(console.log('hello from thread!'));
        printf("hello from thread!\n");
        i++;
        usleep(100);
    }
    emscripten_force_exit(0);
    __builtin_trap();
}

int main()
{

    // XXX FAILED!!! Issues:
    // - Imports in worker.js file.
    // - Have to override ability to find SharedArrayWorker
    // - Seeing the build overflow issue with the worker.js file.
    // - Thread pool size never large enough???
    pthread_t thread;
    pthread_create(&thread, NULL, sidecar_thread, NULL);

    /**
     *  'async' calls: only works when the main loop releases.
     */
    // emscripten_async_call(async_call_trial, 0, 10);

    /**
     *  DOM Handlers // XXX Does not work when embedded in web worker!!
     */

    /**
     *  Main Module
     */
    struct context ctx;
    int simulate_infinite_loop = 1; // NOTE What if =0?  Goes straight to: "x: 5245864"?????
    int fps = -1;                   // 10; // NOTE Set -1 to use browser native.

    ctx.x = 0;
    emscripten_set_main_loop_arg(loop_fn, &ctx, fps, simulate_infinite_loop);

    /**
     * If simulate_infinite_loop = 0, emscripten_set_main_loop_arg won't block
     * and this code will run straight away.
     * If simulate_infinite_loop = 1 then this code will not be reached
     */
    printf("quitting...\n");
}
