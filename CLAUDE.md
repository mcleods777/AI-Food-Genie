# AI Food Genie

## gstack

Use the `/browse` skill from gstack for all web browsing. Never use `mcp__claude-in-chrome__*` tools.

### Available skills

- `/office-hours` - YC Office Hours startup diagnostic
- `/plan-ceo-review` - CEO-perspective plan review
- `/plan-eng-review` - Engineering plan review
- `/plan-design-review` - Design plan review
- `/plan-devex-review` - DevEx plan review
- `/design-consultation` - Design system from scratch
- `/design-shotgun` - Visual design exploration
- `/design-html` - Design to HTML
- `/design-review` - Design audit + fix loop
- `/review` - PR review
- `/ship` - Ship workflow
- `/land-and-deploy` - Merge, deploy, canary verify
- `/canary` - Post-deploy monitoring loop
- `/benchmark` - Performance regression detection
- `/browse` - Headless browser interaction
- `/connect-chrome` - Headed Chrome with side panel
- `/qa` - QA with fixes
- `/qa-only` - Report-only QA
- `/setup-browser-cookies` - Browser cookie setup
- `/setup-deploy` - One-time deploy config
- `/retro` - Retrospective
- `/investigate` - Systematic root-cause debugging
- `/document-release` - Post-ship doc updates
- `/codex` - Multi-AI second opinion
- `/cso` - Security audit (OWASP + STRIDE)
- `/autoplan` - Auto-review pipeline
- `/devex-review` - DevEx review
- `/careful` - Extra careful mode
- `/freeze` - Freeze deployments
- `/guard` - Guard mode
- `/unfreeze` - Unfreeze deployments
- `/gstack-upgrade` - Upgrade gstack
- `/learn` - Learn from documentation

## Skill routing

When the user's request matches an available skill, ALWAYS invoke it using the Skill
tool as your FIRST action. Do NOT answer directly, do NOT use other tools first.
The skill has specialized workflows that produce better results than ad-hoc answers.

Key routing rules:
- Product ideas, "is this worth building", brainstorming → invoke office-hours
- Bugs, errors, "why is this broken", 500 errors → invoke investigate
- Ship, deploy, push, create PR → invoke ship
- QA, test the site, find bugs → invoke qa
- Code review, check my diff → invoke review
- Update docs after shipping → invoke document-release
- Weekly retro → invoke retro
- Design system, brand → invoke design-consultation
- Visual audit, design polish → invoke design-review
- Architecture review → invoke plan-eng-review
- Save progress, checkpoint, resume → invoke checkpoint
- Code quality, health check → invoke health
