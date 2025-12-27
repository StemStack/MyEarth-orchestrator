# Suggested Commit Messages

## Commit Strategy: 6 small commits

### Commit 1: Update User model for freemium
```bash
git add models.py
git commit -m "feat(auth): Add freemium plan to User model

- Add UserPlan enum (FREE | PAID)
- Add plan field to User model (defaults to FREE)
- Add provider_sub field for OAuth sub claim
- Add workspaces relationship to User"
```

### Commit 2: Add Workspace model
```bash
git add models.py
git commit -m "feat(workspace): Add Workspace model for user data organization

- Create Workspace model (id, owner_user_id, name, created_at)
- Add workspace_id foreign key to Layer (nullable)
- Add workspace relationship to Layer"
```

### Commit 3: Add visibility to Layer model
```bash
git add models.py
git commit -m "feat(layers): Add visibility field for freemium model

- Add LayerVisibility enum (PUBLIC | PRIVATE)
- Add visibility field to Layer model (defaults to PUBLIC)
- Keep is_public field for backward compatibility"
```

### Commit 4: Add workspace helpers and optional auth
```bash
git add auth.py
git commit -m "feat(auth): Add workspace helpers and optional auth dependency

- Add get_or_create_workspace() helper
- Add get_current_user_or_anonymous() dependency for freemium
- Update get_or_create_user() to set plan and provider_sub
- Import UserPlan and Workspace models"
```

### Commit 5: Add workspace endpoint and update API
```bash
git add main.py
git commit -m "feat(api): Add workspace endpoint and update auth response

- Add GET /api/workspaces/me endpoint (auto-create workspace)
- Update GET /api/auth/me to include plan field
- Import workspace helpers and new models"
```

### Commit 6: Update database initialization
```bash
git add init_db.py
git commit -m "chore(db): Update init_db.py for freemium schema

- Add schema version docs (v1.1 - Freemium Model)
- Update table creation logs for new tables/fields
- Update admin user creation to require OAuth fields
- Set default plan to FREE for admin users"
```

### Commit 7: Fix frontend auth crashes
```bash
git add frontend/static/js/auth.js
git commit -m "fix(frontend): Prevent auth.js crashes when OAuth not configured

- Add guard clause in handleGoogleSignIn() for undefined credential
- Add handleGoogleSignInButton() wrapper for button clicks
- Add clear error messages with TODO comments
- Show user-friendly alerts pointing to setup docs"
```

### Commit 8: Add documentation
```bash
git add IMPLEMENTATION_PLAN.md FREEMIUM_IMPLEMENTATION_SUMMARY.md COMMIT_MESSAGES.md
git commit -m "docs: Add freemium implementation documentation

- Add IMPLEMENTATION_PLAN.md with deliverables
- Add FREEMIUM_IMPLEMENTATION_SUMMARY.md with detailed changes
- Add COMMIT_MESSAGES.md with suggested commit strategy"
```

---

## Alternative: Single commit (if preferred)
```bash
git add models.py auth.py main.py init_db.py frontend/static/js/auth.js IMPLEMENTATION_PLAN.md FREEMIUM_IMPLEMENTATION_SUMMARY.md COMMIT_MESSAGES.md
git commit -m "feat: Implement freemium auth + private workspace foundation (backend-first)

Backend changes:
- Add UserPlan enum (FREE | PAID) to User model
- Add Workspace model for user data organization
- Add LayerVisibility enum (PUBLIC | PRIVATE) to Layer model
- Add get_current_user_or_anonymous() dependency for optional auth
- Add GET /api/workspaces/me endpoint (auto-create workspace)
- Update init_db.py for new schema (v1.1)

Frontend changes:
- Fix auth.js crashes when OAuth not configured
- Add clear error messages with TODO comments

Documentation:
- Add implementation plan and summary
- Add commit message guide

BREAKING CHANGES:
- Database schema updated (requires migration or recreation)
- New fields: users.plan, users.provider_sub, layers.visibility, layers.workspace_id
- New table: workspaces

See FREEMIUM_IMPLEMENTATION_SUMMARY.md for details."
```

---

## Push to branch
```bash
git push origin feature/auth-private-workspace
```

