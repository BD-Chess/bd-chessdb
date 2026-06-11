# How LLMs Actually Work — Scoreboard & Comparison Report
Generated: 2026-06-11
## Short verdict

The original comparison report was too small. This expanded report tracks Round 1, Round 2, Round 3, the final hybrid-of-hybrids, and the DeepSeek chat/API split.
## Round 1 — original same-prompt answers
| Rank | Model | Score | Verdict | Contribution kept |
|---:|---|---:|---|---|
| 1 | Claude Fable 5 Max | 97 | Best deep technical/system contribution | Post-training, prompt injection, effective context, RLVR/reasoning compute, inference economics. |
| 2 | GPT 5.5 Extended Pro | 96 | Best balanced article base | Clean public draft with sources, transformer core, assistant stack, myth-busting. |
| 3 | Kimi K2.6 Thinking | 94 | Best system-around-engine framing | Request-time pipeline: context assembly, tools, RAG, safety, output loop. |
| 4 | Grok 4.3 Expert | 93 | Strongest blunt myth-busting | Corrected “stochastic parrot”, facts-as-database, RLHF truth myths. |
| 5 | DeepSeek V4 Expert | 91 | Very strong clear explainer | Strong model-vs-product framing and practical analogy; some source checks needed. |
| 6 | Qwen 3.7 Plus | 90 | Strong technical/editorial contributor | Attention/RoPE/SwiGLU notes, self-critique, source-needed checklist. |
| 7 | MiniMax M3 Thinking | 89 | Good structured systems table | Useful component table and inference pipeline. |
| 8 | Gemini 3.1 Pro | 88 | Readable and well structured | Good phase framing and engine-vs-assistant separation. |
| 9 | GLM 5 DeepThink | 86 | Clear lay explanation | Accessible tokens/embeddings/attention explanation. |
| 10 | DeepSeek via API key at RHPm | 85 | Good API-run confirmation and usable draft | Car/wheel-turner analogy; less source discipline; product claims need softening. |
| 11 | MetaAI Thinking | 82 | Solid but generic | Clean basic model-vs-system split. |
| 12 | Mistral LaChat Think | 80 | Readable but weaker synthesis material | Accessible language and myth list. |
| 13 | Copilot Deeper Insights | 74 | Useful concise summary, weakest full answer | Short, compressed, weaker depth/source quality. |

## Round 2 — models review Hybrid v1
| Reviewer | Hybrid v1 | Own original | Delta | Usefulness | Main signal |
|---|---:|---:|---:|---:|---|
| GPT 5.5 Extended Pro | 90 | 86 | +8% | 92 | Praised structure; asked for citations, softer product claims, clearer BD workflow framing. |
| Claude Fable 5 Max | 78 | 84 | −5–10% | 98 | Most valuable critique: add prompt injection, hallucination incentives, base-model example, no-introspective-authority, CoT faithfulness, stronger math. |
| Gemini 3.1 Pro | 92 | 84 | +10% | 87 | Supported structure; wanted product-stack clarity and source discipline. |
| Grok 4.3 Expert | 88 | 82 | +12–15% | 89 | Wanted residual stream, normalization, GQA, equations, hallucination-objective nuance. |
| DeepSeek V4 Expert | 82 | 92 | −10–12% | 93 | Warned v1 lost technical rigor; pushed equations, hedges, source checks. |
| Qwen 3.7 Plus | 92 | 85 | +15% | 91 | Requested attention notation, PagedAttention, batching, KV-cache details. |
| Kimi K2.6 Thinking | 85 | 78 | +10–15% | 94 | Wanted math forward pass, source specificity, self-critique, audit transparency. |
| GLM 5 DeepThink | 92 | 86 | +15% | 88 | Suggested in-context learning, scaling-law note, inference detail. |
| MiniMax M3 Thinking | 83 | 88 | −5% | 95 | Sharp editor critique: add prompt injection, CoT faithfulness, base-model example, hallucination incentives, no-introspective-authority. |
| MetaAI Thinking | 87 | 79 | +10% | 86 | Wanted self-critique, effective-context caution, source-check specificity. |
| Mistral LaChat Think | 92 | 88 | +5% | 90 | Requested more technical depth, multimodality mechanics, self-critique. |
| Copilot Deeper Insights | 90 | 78 | +15–20% | 88 | Citation-light; asked for training-vs-inference distinction and product-feature softening. |
| DeepSeek via API key at RHPm | 92 | 85 | +8% | 89 | Praised balance and BD separation; suggested interpretability primer and context-window source checks. |

## Round 3 — models review Hybrid v2
| Reviewer | Hybrid v2 | Hybrid v1 | Own Round-1 | Main signal |
|---|---:|---:|---:|---|
| GPT 5.5 Extended Pro | 94 | 90 | 86 | Best base; fix equation/soften hallucination incentives. |
| Claude Fable 5 Max | 88 | 78 | 84 | Crossover happened; add KV numbers and acronym definitions. |
| Gemini 3.1 Pro | 96 | 92 | 84 | Strong; trim meta-sections, add tokenizer/MoE/KV specifics. |
| Grok 4.3 Expert | 94 | 88 | 82 | Publish after small cuts; keep structure and BD separation. |
| DeepSeek V4 Expert | 93 | 82 | 92 | v2 beats original as public article; wants more technical precision. |
| Qwen 3.7 Plus | 95 | 92 | 85 | Definitive version; fix citations and ledger weight. |
| Kimi K2.6 Thinking | 91 | 85 | 78 | Best version; add interpretability, emergence caveat, date stamp. |
| GLM 5 DeepThink | 95 | 92 | 86 | Canonical reference; add residual/KV/quantization details. |
| MiniMax M3 Thinking | 84 | 83 | 88 | Only major dissent; meta ledger and human table hurt publication credibility. |
| MetaAI Thinking | 92 | 87 | 79 | Best so far; cut ledger, add product hedges and source checks. |
| Mistral LaChat Think | 97 | 92 | 88 | Near-flawless after small fixes. |
| Copilot Deeper Insights | 94 | 90 | 78 | Publishable with minor edits; add decoding/MoE/tool failure details. |
| DeepSeek via API | 92 | n/a | 85 | Hybrid better; wants interpretability and tokenization details. |

## Final hybrid-of-hybrids comparison
| Version | Score | Why |
|---|---:|---|
| Claude HTML | 95 | Best reader-facing article: stronger flow, examples, references, and three-layer framing. |
| GPT HTML | 92 | Better method/source-spine structure and BD workflow separation, but less polished as a public page. |
| Hybrid of hybrids | 97 | Uses Claude as public article base, imports GPT method discipline, adds EN/SL toggle and BD/RHPm separation. |

## DeepSeek chat vs DeepSeek via API
| Checkpoint | DeepSeek V4 Expert chat | DeepSeek via RHPm API | Interpretation |
|---|---:|---:|---|
| Round 1 original-answer score | 91 | 85 | Chat V4 Expert was stronger: more complete and stricter technically. API run was usable but thinner. |
| Round 2: score given to Hybrid v1 | 82 | 92 | Chat DeepSeek was much harsher and exposed real lost rigor. API DeepSeek was more positive/agreement-prone. |
| Round 2: own-original score | 92 | 85 | Chat DeepSeek rated its own answer far higher; API run was more modest. |
| Round 3: score given to Hybrid v2 | 93 | 92 | Both validated v2. Chat barely preferred v2 to its own original; API clearly preferred v2 to its original. |

**Practical verdict:** DeepSeek V4 Expert chat was the stronger reviewer and answer-writer. DeepSeek via API was valuable as a convenience/local-workflow test and produced a usable draft, but it was less rigorous and less source-disciplined in this run. For article quality and red-team critique, use chat. For fast local RHPm workflow testing, use API.
