# AIm3 MentalArena Context Packs

These files are compact project-context capsules for the private Local Lab.
They are safe to ship publicly because they contain no API keys and no private logs.

Usage:
1. Select one or more packs in the Lab.
2. Choose Light / Standard / Deep.
3. Preview context.
4. Start a council run.
5. The helper writes `02_PROJECT_CONTEXT.md` into the run folder and prepends the same context to every non-direct LLM call.

Best practice:
- Use no context for generic tests.
- Use MentalArena context for Lab/v0.7 decisions.
- Use 8Z/TSP/Arena packs for cross-domain builds.
- Keep packs dense and small. Do not dump full papers/code unless a specific model/tool can cache or retrieve them.
