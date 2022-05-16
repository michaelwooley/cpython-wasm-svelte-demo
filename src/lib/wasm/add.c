
#include <pthread.h>
#include <emscripten.h>
#include <emscripten/html5.h>

int add(int a, int b)
{
    return a + b;
}

void *thread_main(void *arg)
{
    EM_ASM(out('hello from thread!'));
    emscripten_force_exit(0);
    __builtin_trap();
}

int main()
{
    pthread_t thread;
    pthread_create(&thread, NULL, thread_main, NULL);
    emscripten_exit_with_live_runtime();
    __builtin_trap();
}