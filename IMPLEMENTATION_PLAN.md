# Auth + Private Workspace Implementation Plan

## Status: Backend-first, minimal frontend changes

## Deliverables v1

### 1. Auth Foundation (FastAPI)
- [x] User model exists with OAuth fields
- [ ] Add `plan` enum field (free|paid) to User
- [ ] Add `provider_sub` field to User (OAuth subject claim)
- [x] JWT token strategy (Bearer token) - already implemented
- [ ] Add `get_current_user_or_anonymous()` dependency (returns User or None)

### 2. Workspace Concept
- [ ] Create Workspace model (id, owner_user_id, name, created_at)
- [ ] Add endpoint: GET /workspaces/me (auto-create workspace on first login)
- [ ] Add foreign key: Layer.workspace_id (optional, nullable for now)

### 3. Visibility + Ownership (Freemium model)
- [ ] Update Layer model:
  - Rename `user_id` → `owner_user_id` (or keep user_id, clarify in docs)
  - Add `visibility` enum: 'public' | 'private'
  - Default visibility logic: free users → public, paid users → can choose
- [ ] Policy hook: document where to add "downgrade to public" logic

### 4. Frontend Compatibility
- [x] OAuth endpoints exist: /api/auth/google, /api/auth/github, /api/auth/linkedin
- [x] GET /api/auth/me exists
- [ ] Fix frontend auth.js to fail gracefully (no crash) with TODO for OAuth config

## Files to Change

### Backend
1. `models.py` - Update User, add Workspace, update Layer
2. `auth.py` - Add get_current_user_or_anonymous()
3. `main.py` - Add GET /workspaces/me endpoint
4. `init_db.py` - Update to create new tables/columns (or create migration script)

### Frontend
1. `frontend/static/js/auth.js` - Minimal fix to prevent crashes

## Commit Strategy

**Commit 1: Update User model for freemium**
- Add plan enum (free|paid)
- Add provider_sub field
- Update init_db.py

**Commit 2: Add Workspace model**
- Create Workspace table
- Add foreign key to Layer (nullable)
- Update init_db.py

**Commit 3: Add visibility to Layer model**
- Add visibility enum field
- Update Layer creation logic to set default visibility based on user plan
- Document policy hook for downgrade-to-public

**Commit 4: Add workspace endpoints**
- GET /workspaces/me (create-on-first-login)
- Add get_current_user_or_anonymous() dependency

**Commit 5: Fix frontend auth.js crashes**
- Add try-catch and TODO comments for OAuth setup
- Ensure graceful failure

## Architecture Decisions

### Token Strategy: JWT Bearer Token (CHOSEN)
- Already implemented in auth.py
- Client stores token in localStorage
- Sent as `Authorization: Bearer <token>` header

### Database: Shared schema (CHOSEN)
- Single `users` table
- Single `layers` table with owner_user_id + visibility
- Single `workspaces` table with owner_user_id

### Visibility Rules
- `public`: readable by anyone (auth or anon)
- `private`: readable only by owner

### Freemium Policy
- Free users: created data defaults to `visibility='public'`
- Paid users: can set `visibility='private'`
- Downgrade hook: when user.plan changes from 'paid' → 'free', set all their private layers to public

## Next Steps (Future)
- OAuth provider setup guide (Google, GitHub, LinkedIn)
- Frontend OAuth flow implementation
- Payment integration (Stripe/PayPal)
- Admin panel for plan management
- Downgrade cron job (auto-downgrade expired paid users)

