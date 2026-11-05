# AI-Coded Marketplace Security

**Computer Security Final Project**

We had two AI models build the same online marketplace from two prompts (4 builds total). Each build goes through one fixed security test plan, and we compare which vulnerabilities each one ships with.

> **Research question:** Does one added line asking for security change what an AI-built web app ships with?

| Build | Model | Prompt |
|---|---|---|
| [A-V1](builds/a-v1) | Haiku 4.5, low effort | [V1: base](prompts/v1-base.md) |
| [A-V2](builds/a-v2) | Haiku 4.5, low effort | [V2: security line + base](prompts/v2-security.md) |
| [B-V1](builds/b-v1) | Opus 5.5, max effort | [V1: base](prompts/v1-base.md) |
| [B-V2](builds/b-v2) | Opus 5.5, max effort | [V2: security line + base](prompts/v2-security.md) |

## Repo layout

```
homepage/      Static project homepage (hand-built, out of scope for testing)
builds/        One folder per build, committed exactly as generated
  a-v1/  a-v2/  b-v1/  b-v2/
prompts/       The exact prompts + the word-for-word prompt log
test-plan/     The locked test plan (T01–T18), committed before any build
results/       Results grid, raw scan output, screenshots
```

## Rules for this repo

1. **Lock the test plan first.** Commit `test-plan/` before generating any build.
2. **Commit builds as generated.** One commit per build with the untouched AI output. Fixes from remediation go in later commits.
3. **Log every prompt.** Every prompt and follow-up goes in `prompts/prompt-log.md`, word for word, with a timestamp.
4. **No real secrets.** `.env` and `.dev.vars` are git-ignored. Use `.env.example` with placeholder values. gitleaks scans this repo (T14), so a leaked key here counts against us.

## Homepage

`homepage/index.html` is a single static file with no build step. To update links, edit the `EDIT HERE` block near the bottom of the file:

- `DOMAIN`: set once (e.g. `example.com`) and every build links to `https://a-v1.example.com` and so on.
- `codeUrl`: already points at each build folder in this repo.
- `RESULTS`: fill in Pass/Fail per test once testing is done.

To deploy it on Cloudflare: Workers & Pages → Create → Import a repository → pick this repo. Name the project `computerfinal` (it must match `name` in `wrangler.jsonc`), leave the build command empty, and keep the deploy command as `npx wrangler deploy`. `wrangler.jsonc` tells Cloudflare to serve only the `homepage/` folder. Put the homepage and every build behind Cloudflare Access so only the team and instructor can reach them.

To view it locally, open `homepage/index.html` in a browser.
