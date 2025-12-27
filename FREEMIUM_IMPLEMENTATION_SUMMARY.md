# Freemium Auth + Private Workspace Implementation Summary

## ✅ Implementation Complete (Backend-first, v1)

This document summarizes the changes made to implement the freemium authentication and private workspace foundation.

---

## Changes Made

### 1. Database Models (`models.py`)

#### Added Enums
- `UserPlan`: `FREE` | `PAID`
- `LayerVisibility`: `PUBLIC` | `PRIVATE`

#### Updated `User` Model
**New fields:**
- `provider_sub` (String, nullable): OAuth 'sub' claim for JWT compatibility
- `plan` (Enum): User subscription plan, defaults to `FREE`

**Relationships:**
- Added `workspaces` relationship (one-to-many)

#### Created `Workspace` Model (NEW)
**Fields:**
- `id` (String, PK): UUID
- `owner_user_id` (String, FK → users.id): Workspace owner
- `name` (String): Workspace name, defaults to "My Workspace"
- `description` (Text, nullable)
- `created_at`, `updated_at` (DateTime)

**Relationships:**
- `owner` → User
- `layers` → Layer (one-to-many)

#### Updated `Layer` Model
**New fields:**
- `workspace_id` (String, FK → workspaces.id, nullable): Optional workspace association
- `visibility` (Enum): `PUBLIC` | `PRIVATE`, defaults to `PUBLIC`

**Kept for compatibility:**
- `is_public` (Boolean): Legacy field, maintained for backward compatibility

**New relationship:**
- `workspace` → Workspace

---

### 2. Authentication System (`auth.py`)

#### New Imports
- `UserPlan`, `Workspace` from models

#### Updated `get_or_create_user()`
- Now sets `provider_sub` from OAuth data
- Sets `plan = UserPlan.FREE` for new users

#### New Function: `get_or_create_workspace()`
**Purpose:** Get or create user's default workspace (auto-created on first access)

**Behavior:**
- Looks for existing workspace by `owner_user_id`
- Creates one if not found
- Returns workspace object

#### New Dependency: `get_current_user_or_anonymous()`
**Purpose:** Optional authentication for freemium model

**Behavior:**
- Returns `User` object if valid token provided
- Returns `None` if no token or invalid token (treats as anonymous)
- Does NOT raise errors (unlike `get_current_user()`)

**Use cases:**
- Endpoints that serve both authenticated and anonymous users
- Public content + private content visibility filtering
- Free vs. paid feature gating

---

### 3. API Endpoints (`main.py`)

#### Updated Imports
Added:
- `get_current_user_or_anonymous`
- `get_or_create_workspace`
- `UserPlan`, `LayerVisibility`, `Workspace`

#### Updated `GET /api/auth/me`
**New field in response:**
- `plan`: User's subscription plan (`"free"` or `"paid"`)

#### New Endpoint: `GET /api/workspaces/me`
**Authentication:** Required (Bearer token)

**Behavior:**
- Returns user's default workspace
- Auto-creates workspace if it doesn't exist (first login)

**Response:**
```json
{
  "id": "uuid",
  "owner_user_id": "uuid",
  "name": "User's Workspace",
  "description": "Default workspace",
  "created_at": "2025-12-27T...",
  "updated_at": "2025-12-27T..."
}
```

---

### 4. Database Initialization (`init_db.py`)

#### Updated Documentation
- Added schema version note (v1.1 - Freemium Model)
- Listed all new fields and tables

#### Updated `init_database()`
- Now prints detailed schema information during setup
- Mentions new `workspaces` table
- Notes new fields in `users` and `layers`

#### Updated `create_admin_user()`
- Now requires OAuth provider and OAuth ID (admin users must use OAuth)
- Sets default plan to `FREE` (can be upgraded manually in DB)
- Added warnings about OAuth requirement

---

### 5. Frontend Compatibility (`frontend/static/js/auth.js`)

#### Added Safety Checks
**Problem:** Google button called `handleGoogleSignIn()` without credential → crash

**Solution:**
1. Added guard clause in `handleGoogleSignIn()`:
   - Checks if `response` and `response.credential` exist
   - Logs clear error message if missing
   - Shows user-friendly error instead of crashing

2. Added `handleGoogleSignInButton()` wrapper:
   - Called when user clicks button (separate from OAuth callback)
   - Shows clear "not configured" message
   - Points to setup documentation

3. Enhanced error logging:
   - All OAuth errors now logged with TODO comments
   - Alerts user with reference to `OAUTH_SETUP_GUIDE.md`

#### TODO Comments Added
- Google Sign-In: Needs GSI script loaded and proper button rendering
- GitHub/LinkedIn: Need OAuth flow implementation
- All providers: Need OAuth credentials configured in `.env`

**Result:** Frontend no longer crashes. Shows clear error messages instead.

---

## Freemium Model Rules

### Visibility Logic
- **Public layers:** Readable by anyone (authenticated or anonymous)
- **Private layers:** Readable only by owner (must be authenticated)

### User Plan Defaults
- **Free users:** New layers default to `visibility='public'`
- **Paid users:** Can choose `visibility='private'`

### Downgrade Policy Hook
**Location to implement:** (Future feature)

When user downgrades from paid → free:
```python
# Pseudo-code (implement in payment webhook or cron job)
if user.plan changed from PAID to FREE:
    for layer in user.layers:
        if layer.visibility == LayerVisibility.PRIVATE:
            layer.visibility = LayerVisibility.PUBLIC
            # Optional: notify user
    db.commit()
```

**Recommendation:** Implement this in:
- Payment webhook (Stripe/PayPal subscription cancelled)
- Scheduled cron job (daily check for expired subscriptions)

---

## Architecture Decisions

### Token Strategy
**Chosen:** JWT Bearer Token (already implemented)
- Client stores token in localStorage
- Sent as `Authorization: Bearer <token>` header
- Validated by `get_current_user()` dependency

### Database Schema
**Chosen:** Shared DB (NO schema-per-user)
- Single `users` table with `plan` field
- Single `layers` table with `owner_user_id` + `visibility`
- Single `workspaces` table with `owner_user_id`

**Access control:** Row-level via visibility enum

### Workspace Model
**v1 Simplification:** One workspace per user (auto-created)
- Created on first access to `/api/workspaces/me`
- Name defaults to `"{username}'s Workspace"`

**Future:** Multi-workspace support for power users

---

## Files Changed

### Backend
1. ✅ `models.py` - Updated User, created Workspace, updated Layer
2. ✅ `auth.py` - Added workspace helper, optional auth dependency
3. ✅ `main.py` - Added `/workspaces/me` endpoint, updated imports
4. ✅ `init_db.py` - Updated schema docs, admin user creation

### Frontend
1. ✅ `frontend/static/js/auth.js` - Added error handling, TODO comments

### Documentation
1. ✅ `IMPLEMENTATION_PLAN.md` - Initial plan (created)
2. ✅ `FREEMIUM_IMPLEMENTATION_SUMMARY.md` - This file (created)

---

## Commit Strategy

### Commit 1: Update User model for freemium
```
feat(auth): Add freemium plan to User model

- Add UserPlan enum (FREE | PAID)
- Add plan field to User model (defaults to FREE)
- Add provider_sub field for OAuth sub claim
- Update get_or_create_user() to set plan for new users
```

### Commit 2: Add Workspace model
```
feat(workspace): Add Workspace model for user data organization

- Create Workspace model (id, owner_user_id, name, created_at)
- Add workspaces relationship to User
- Add workspace_id foreign key to Layer (nullable)
- Add get_or_create_workspace() helper in auth.py
```

### Commit 3: Add visibility to Layer model
```
feat(layers): Add visibility field for freemium model

- Add LayerVisibility enum (PUBLIC | PRIVATE)
- Add visibility field to Layer model (defaults to PUBLIC)
- Keep is_public field for backward compatibility
- Document visibility rules (public = anyone, private = owner only)
```

### Commit 4: Add workspace endpoints and optional auth
```
feat(api): Add workspace endpoint and optional auth dependency

- Add GET /api/workspaces/me endpoint (auto-create workspace)
- Add get_current_user_or_anonymous() dependency
- Update GET /api/auth/me to include plan field
- Update imports in main.py
```

### Commit 5: Update init_db.py for new schema
```
chore(db): Update init_db.py for freemium schema

- Add schema version docs (v1.1)
- Update table creation logs
- Update admin user creation (require OAuth fields)
- Add notes about new fields and tables
```

### Commit 6: Fix frontend auth.js crashes
```
fix(frontend): Prevent auth.js crashes when OAuth not configured

- Add guard clause in handleGoogleSignIn()
- Add handleGoogleSignInButton() wrapper for button clicks
- Add clear error messages with TODO comments
- Show user-friendly alerts pointing to setup docs
- No longer crashes on undefined response.credential
```

---

## Next Steps (Future Work)

### Phase 2: OAuth Configuration
1. Set up OAuth apps (Google, GitHub, LinkedIn)
2. Configure client IDs in `.env`
3. Add Google Sign-In script to `index.html`
4. Implement proper GSI button rendering
5. Test OAuth flow end-to-end

**Reference:** See `docs/OAUTH_SETUP_GUIDE.md` (if exists)

### Phase 3: Payment Integration
1. Choose payment provider (Stripe recommended)
2. Add payment endpoints
3. Implement subscription webhooks
4. Add upgrade/downgrade flows
5. Implement downgrade-to-public policy

### Phase 4: Access Control Enforcement
1. Update layer list endpoints to filter by visibility + ownership
2. Add visibility checks to layer read endpoints
3. Add plan checks to layer create/update (free users forced to public)
4. Add rate limits (free users stricter limits)

### Phase 5: Admin Panel
1. Add admin UI for plan management
2. Add manual upgrade/downgrade buttons
3. Add usage statistics
4. Add payment history view

---

## Testing Checklist

### Backend
- [ ] User creation sets plan=FREE by default
- [ ] GET /api/auth/me includes plan field
- [ ] GET /api/workspaces/me creates workspace on first access
- [ ] get_current_user_or_anonymous() returns None without token
- [ ] get_current_user_or_anonymous() returns User with valid token
- [ ] init_db.py creates all tables without errors

### Frontend
- [ ] Clicking Google button shows error (not crash)
- [ ] Clicking GitHub button shows error (not crash)
- [ ] Clicking LinkedIn button shows error (not crash)
- [ ] Error messages reference OAuth setup docs

### Database
- [ ] Run `python init_db.py` successfully
- [ ] Verify `workspaces` table created
- [ ] Verify `users` table has `plan` and `provider_sub` columns
- [ ] Verify `layers` table has `visibility` and `workspace_id` columns

---

## Migration Notes

### For Existing Databases
If you have an existing database with users/layers:

1. **Option A: Recreate database (dev/test only)**
   ```bash
   dropdb myearth && createdb myearth
   python init_db.py
   ```

2. **Option B: Manual migration (production)**
   ```sql
   -- Add new columns to users
   ALTER TABLE users ADD COLUMN provider_sub VARCHAR;
   ALTER TABLE users ADD COLUMN plan VARCHAR DEFAULT 'free';
   
   -- Create workspaces table
   CREATE TABLE workspaces (
     id VARCHAR PRIMARY KEY,
     owner_user_id VARCHAR REFERENCES users(id),
     name VARCHAR NOT NULL,
     description TEXT,
     created_at TIMESTAMP DEFAULT NOW(),
     updated_at TIMESTAMP DEFAULT NOW()
   );
   
   -- Add new columns to layers
   ALTER TABLE layers ADD COLUMN workspace_id VARCHAR REFERENCES workspaces(id);
   ALTER TABLE layers ADD COLUMN visibility VARCHAR DEFAULT 'public';
   ```

3. **Option C: Use Alembic (recommended for production)**
   ```bash
   # Install alembic
   pip install alembic
   
   # Initialize (first time only)
   alembic init alembic
   
   # Generate migration
   alembic revision --autogenerate -m "Add freemium model"
   
   # Review migration file, then apply
   alembic upgrade head
   ```

---

## Security Notes

### Access Control
- **Current state:** Backend validates tokens, but does NOT enforce visibility yet
- **TODO:** Add visibility enforcement in layer API endpoints
- **TODO:** Add ownership checks in layer update/delete endpoints

### Token Security
- JWT secret must be set in `.env` (not default value)
- Tokens expire after 30 minutes (configurable)
- No refresh token implemented yet (TODO for production)

### OAuth Security
- OAuth client secrets must NEVER be committed to git
- Use environment variables only
- Validate OAuth tokens on backend (already implemented)

---

## Support

### Documentation
- `IMPLEMENTATION_PLAN.md` - Original implementation plan
- `FREEMIUM_IMPLEMENTATION_SUMMARY.md` - This file
- `docs/OAUTH_SETUP_GUIDE.md` - OAuth setup instructions (if exists)
- `env.example` - Environment variable reference

### Troubleshooting

**Q: Frontend shows "OAuth not configured" errors?**
A: This is expected! OAuth setup is required. See next steps above.

**Q: Database creation fails?**
A: Check your DATABASE_URL in `.env`. Ensure PostgreSQL is running.

**Q: Workspaces not being created?**
A: Check that user is authenticated when calling `/api/workspaces/me`

**Q: How to upgrade a user to paid?**
A: Manually in database for now:
```sql
UPDATE users SET plan = 'paid' WHERE email = 'user@example.com';
```

---

## Success Criteria ✅

- [x] Backend foundation for freemium model complete
- [x] User model supports free/paid plans
- [x] Workspace model created
- [x] Layer model supports public/private visibility
- [x] Optional authentication dependency available
- [x] Frontend doesn't crash (shows clear errors instead)
- [x] Database initialization updated
- [x] Documentation complete

**Status:** ✅ v1 Backend-first implementation COMPLETE

**Ready for:** Phase 2 (OAuth configuration) or Phase 4 (Access control enforcement)

