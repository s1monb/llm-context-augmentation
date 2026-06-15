# 1 · Context stuffing

> Paste the knowledge directly into the prompt. The crudest and most reliable way to give a model facts it never learned.

## What it does

1. Asks the model the question with **no** context → it admits it doesn't know.
2. Pastes the **entire** knowledge base into the prompt and asks again → it answers correctly.

## Mechanism

```
[ all docs ] + [ question ]  ──►  one LLM call  ──►  answer
```

No weights change. No retrieval. Knowledge exists only for the duration of the request.

## Run

```bash
npm run 1:context
```

## Trade-offs

| 👍 | 👎 |
|----|----|
| Zero infrastructure | Every token is paid for on every call |
| Always sees everything (no retrieval misses) | Doesn't scale past the context window |
| Trivial to implement | No citations / source of truth |

**Use when:** the knowledge base is small and static, or fits comfortably in context.
