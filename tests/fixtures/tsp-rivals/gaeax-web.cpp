#include "env.h"
#include <emscripten.h>
#include <vector>

EM_JS(void, reportTour, (const int* cities, int size, int length), {
    Module.onBest(HEAP32.slice(cities >>> 2, (cities >>> 2) + size), length);
});

EM_JS(int, deadlineReached, (), {
    return Module.deadlineReached() ? 1 : 0;
});

extern "C" EMSCRIPTEN_KEEPALIVE void solve(int seed) {
    // A fresh worker owns this upstream environment for its entire lifetime.
    auto* env = new TEnvironment();
    InitURandom(seed);
    char input[] = "/problem.tsp";
    env->fNumOfPop = 100;
    env->fNumOfKids = 30;
    env->fFileNameTSP = input;
    env->fFileNameInitPop = nullptr;
    env->Define();
    if (deadlineReached()) return;
    env->InitPop();
    env->Init();
    env->GetEdgeFreq();
    int best = -1;
    std::vector<int> order(env->fEvaluator->Ncity);
    for (;;) {
        env->SetAverageBest();
        if (best < 0 || env->fBestValue < best) {
            best = env->fBestValue;
            int previous = -1;
            int current = 0;
            for (int& city : order) {
                city = current;
                int next = env->tBest.fLink[current][0];
                if (next == previous) next = env->tBest.fLink[current][1];
                previous = current;
                current = next;
            }
            reportTour(order.data(), order.size(), best);
        }
        if (deadlineReached() || env->TerminationCondition()) return;
        env->SelectForMating();
        for (int i = 0; i < env->fNumOfPop; ++i) {
            env->GenerateKids(i);
            env->SelectForSurvival(i);
            if (deadlineReached()) break;
        }
        ++env->fCurNumOfGen;
    }
}
