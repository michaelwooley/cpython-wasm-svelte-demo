

#include <pthread.h>
#include <emscripten.h>
#include <emscripten/html5.h>
#include <emscripten/threading.h>
#include <stdio.h>

int add(int a, int b)
{
    return a + b;
}

void sleep(double msecs)
{
    double t1 = emscripten_get_now();
    emscripten_thread_sleep(msecs);
    double t2 = emscripten_get_now();
    printf("emscripten_thread_sleep() slept for %f msecs.\n", t2 - t1);
}

void *thread_main(void *arg)
{
    EM_ASM(out('hello from thread!'));

    sleep(1000);
    int is_main = emscripten_is_main_browser_thread();
    int is_runtime = emscripten_is_main_runtime_thread();
    printf("is main thread? %d, runtime? %d\n", is_main, is_runtime);
    EM_ASM(out('hello from thread again...'));
    emscripten_force_exit(0);
    __builtin_trap();
}

int main()
{
    // pthread_t thread;
    // pthread_create(&thread, NULL, thread_main, NULL);
    thread_main(NULL);
    emscripten_exit_with_live_runtime();
    __builtin_trap();
}