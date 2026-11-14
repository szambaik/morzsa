# Morzsa Free + Plus: implementation and cost plan

Planning snapshot: 14 November 2026. USD estimates exclude tax, FX, payment/store fees and infrastructure. This is a proposal; it does not change today's providers or enable billing.

## Product split

Keep inventory, shared shopping, Shopping Mode, recipes, cooking progress and approximate availability in Free. A household must not lose its pantry or lists when Plus expires. Keep today's Groq text + Gemini recorded voice/photo + Cloudflare images as the Free provider route. Free quotas belong to the provider account/project, not independently to every Morzsa user.

Plus improves the assistant: fast streamed answers and stronger follow-ups, better images, optional natural two-way voice with interruption and safe tools, higher explicit allowances and a visible usage balance. Use one subscription per household, shared by members, with an individual/local-kitchen entitlement too. Both modes operate on the same data. Never silently upgrade a Free request or charge beyond an allowance.

## Recommended models

| Task | Plus default | Stronger option |
|---|---|---|
| Chat, recipes and natural-language actions | `gpt-6-luna`, standard speed | `gpt-6.1-terra` for ambiguity, complex constraints or repeated correction |
| Images | `gpt-image-2.6-flare`, explicit modest size/quality | Higher quality only on request, within the image allowance |
| Natural conversational voice | `gpt-realtime-2.1-mini` over WebRTC | Larger Realtime only if measured quality requires it |
| Alternative voice architecture | `gpt-live-1` orchestrating Luna/Terra | Simpler text-agent orchestration, but duration billing |

Do not start with Astra/Sol for routine kitchen questions. Cap Terra escalation at 10% initially. Evaluate Hungarian comprehension, recipe constraints, safe tools, latency and image quality before making these selections final. Realtime supports speech-to-speech, turn taking, interruption and tools; a custom Morzsa integration still needs transport, session controls and tool implementation. A ChatGPT subscription does not pay for Morzsa API calls.

## Verified rates and sources

Official sources checked for this plan:

- [OpenAI API pricing](https://developers.openai.com/api/docs/pricing)
- [Realtime token accounting and costs](https://developers.openai.com/api/docs/guides/realtime-costs)
- [Realtime integration](https://developers.openai.com/api/docs/guides/realtime)
- [Image generation and cost calculator](https://developers.openai.com/api/docs/guides/image-generation)
- [Cloudflare Workers AI pricing](https://developers.cloudflare.com/workers-ai/platform/pricing/)

| Model/modality | Input / 1M tokens | Output / 1M tokens | Cached input / 1M |
|---|---:|---:|---:|
| GPT-6 Luna text | $0.10 | $0.50 | $0.01 |
| GPT-6.1 Terra text | $1.00 | $5.00 | $0.05 |
| GPT-Realtime-2.1 mini audio | $10 | $20 | $0.30 |
| GPT-Realtime-2.1 mini text | $0.60 | $2.40 | $0.06 |
| GPT-Realtime-2.1 audio | $32 | $64 | $0.40 |
| GPT-Image-2.6 Flare image | $8 | $30 | $2 |
| GPT-Image-2.6 Flare text prompt | $5 | — | $1.25 |

GPT-Live-1 costs **$0.05 per connected voice minute**, billed per second, plus backend model/tool costs. A 15-second initialisation charge is credited toward the running session; do not count it twice. Silence while connected still costs duration fees.

Realtime uses 600 input audio tokens per user spoken minute and 1,200 output tokens per assistant spoken minute. Mini's fresh audio costs approximately **$0.006/user minute + $0.024/assistant minute**; the larger model is $0.0192 + $0.0768 respectively. These exclude replayed/cached history, text, tools, separately enabled transcription and reconnects. They are not flat whole-session rates.

Cloudflare currently provides **10,000 free neurons per account per day**. Paid overage costs $0.011/1,000 neurons on a paid Workers plan. This supports a small Free pilot, not unlimited free images per household.

## Monthly household estimates

Assumptions are explicit, with no assumed text caching:

- Normal chat: 3,000 input + 800 output tokens. Luna costs $0.0007; Terra $0.007. A 10% Terra mix averages **$0.00133/request**.
- Full recipe: 10,000 input + 4,000 output Luna tokens: **$0.003/recipe**, counted separately from ordinary chat.
- Image budget: 1,000 image output tokens ($0.03) + 200 text prompt tokens ($0.001): **$0.031/image**. This is a budgeting assumption, not a guaranteed resolution/quality price. The official calculator example reports 823 output tokens/$0.02469 before input costs. Actual counts depend on dimensions/quality; benchmark explicit presets and returned usage.
- Voice minutes below are **combined user + assistant spoken minutes**, split 50/50. The fresh-audio floor is $0.015/combined minute. Budget **$0.02–0.04/minute** with bounded context and history/tool/text overhead. Measure this in a real 10-minute Hungarian session before selling an allowance.
- One cover + at most two useful technique images per cooked recipe, cached and reused across both members.

| Monthly use | Light | Regular | Heavy |
|---|---:|---:|---:|
| Ordinary chat requests | 200 | 500 | 1,000 |
| Generated recipes | 10 | 20 | 40 |
| Newly generated images | 30 | 60 | 120 |
| Combined spoken voice minutes | 15 | 60 | 180 |
| Chat incl. 10% Terra | $0.27 | $0.67 | $1.33 |
| Recipe generation | $0.03 | $0.06 | $0.12 |
| Images | $0.93 | $1.86 | $3.72 |
| Voice budget | $0.30–0.60 | $1.20–2.40 | $3.60–7.20 |
| API subtotal | **$1.53–1.83** | **$3.79–4.99** | **$8.77–12.37** |
| With 25% retry/variance reserve | **$1.91–2.29** | **$4.73–6.23** | **$10.96–15.46** |

For comparison, 60 connected GPT-Live minutes add $3 before backend costs. Realtime mini is likely cheaper with concise speech and bounded audio context; GPT-Live may be simpler to build. Test both.

## Cost-effective launch offer

Start with one limited Plus tier, provisionally **€7.99/household/month**: 500 ordinary AI requests, 30 images and 30 combined spoken voice minutes. Under these assumptions, including 20 separate recipe calls, API cost is approximately **$2.82–3.57 with a 25% reserve**. This is a product hypothesis, not a profitability guarantee: tax, platform/payment commissions, FX, hosting, support and refunds must still fit.

Do not offer unlimited images/voice. Add separately purchased packs later. Show the remaining allowance, let users continue with Free, and keep checkout out of active cooking steps. Validate conversion with the five-couple pilot before adding tiers.

## Implementation sequence

1. **Provider boundary: 1–2 focused iterations.** Preserve all Free env/config. Resolve Plus from server-validated entitlements, never a client tier parameter. Add Luna/Flare adapters behind the same structured answer/recipe/action schema, RLS context and review/save/undo paths.
2. **Spend guard: 1 iteration.** Ledger household id, deduplicated request id, provider/model, modality, usage, duration, estimated cost and status. No raw chat/audio in the ledger. Atomically reserve worst-case cost before a call; settle against usage; expire abandoned reservations. Daily/monthly caps and escalation limits.
3. **Image pilot: 1 iteration.** Compare 10 local dishes and two useful steps each. Measure success, cost, latency and technique usefulness. Stable recipe+step+version cache, one in-flight job, modest preset, selected in-view generation. Avoid streaming partial images: they add billable image tokens.
4. **Voice prototype: 2–3 iterations.** Server issues short-lived credentials; WebRTC starts only after a user action. VAD, interruption, mute, transcript, current recipe/step and explicit end. Server-enforced allowance. Compact active-recipe context replaces an ever-growing transcript. Close idle sessions and recover cooking progress after disconnect.
5. **Safe tools.** Read pantry/list/recipe, navigate steps and start timers. Data changes use existing reviewed, idempotent, revision-checked saves. Navigation/timers can act immediately. Responses distinguish suggestions, pending saves and confirmed saves. Reconnects must not execute tools twice.
6. **Billing after validation.** Web checkout plus verified subscription webhooks; platform-appropriate native subscriptions. Specify household ownership, grace periods, cancellation, transfer and restore-purchases. Check current store rules and fees at implementation time; external web checkout is not automatically a permitted native purchase route.
7. **Pilot gate.** Ten scripted Hungarian voice scenarios plus five real couples. Measure first-token/audio latency, relevant follow-ups, safe tool completion, image usefulness, cost per active household, coordination effort and four-week retention. Launch when the 95th-percentile measured cost fits allowance economics.

## Acceptance criteria

- Free behaviour and household data survive Plus rollout, switching tier and cancellation.
- Non-members cannot get paid voice credentials or spend another household's budget.
- Retrying a request/tool does not charge or save twice.
- No model/payment secret appears in web/native bundles.
- Speech can be interrupted; touch/text work when microphone/network fails.
- Measured costs and remaining allowance are visible; model/rate configuration can be changed without moving user data.
- Recheck official prices before implementation and release.
