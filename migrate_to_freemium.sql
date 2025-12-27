-- Migration script for Freemium Model (v1.1)
-- Run this on existing databases to add new fields and tables
-- 
-- Usage:
--   psql -U postgres -d myearth -f migrate_to_freemium.sql
--
-- Or from psql:
--   \i migrate_to_freemium.sql

BEGIN;

-- ============================================
-- 1. Update users table
-- ============================================
DO $$ 
BEGIN
    -- Add provider_sub column (OAuth 'sub' claim)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='provider_sub'
    ) THEN
        ALTER TABLE users ADD COLUMN provider_sub VARCHAR;
        RAISE NOTICE 'Added users.provider_sub column';
    ELSE
        RAISE NOTICE 'users.provider_sub already exists, skipping';
    END IF;

    -- Add plan column (free/paid)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='users' AND column_name='plan'
    ) THEN
        -- Create enum type first
        CREATE TYPE user_plan AS ENUM ('free', 'paid');
        ALTER TABLE users ADD COLUMN plan user_plan DEFAULT 'free' NOT NULL;
        RAISE NOTICE 'Added users.plan column';
    ELSE
        RAISE NOTICE 'users.plan already exists, skipping';
    END IF;
END $$;

-- Set all existing users to free plan (if column was just added)
UPDATE users SET plan = 'free' WHERE plan IS NULL;

-- ============================================
-- 2. Create workspaces table
-- ============================================
CREATE TABLE IF NOT EXISTS workspaces (
    id VARCHAR PRIMARY KEY,
    owner_user_id VARCHAR NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR NOT NULL DEFAULT 'My Workspace',
    description TEXT,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Create index on owner_user_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_workspaces_owner_user_id ON workspaces(owner_user_id);

-- ============================================
-- 3. Update layers table
-- ============================================
DO $$ 
BEGIN
    -- Add workspace_id column (nullable, optional association)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='layers' AND column_name='workspace_id'
    ) THEN
        ALTER TABLE layers ADD COLUMN workspace_id VARCHAR REFERENCES workspaces(id) ON DELETE SET NULL;
        RAISE NOTICE 'Added layers.workspace_id column';
    ELSE
        RAISE NOTICE 'layers.workspace_id already exists, skipping';
    END IF;

    -- Add visibility column (public/private)
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name='layers' AND column_name='visibility'
    ) THEN
        -- Create enum type first
        CREATE TYPE layer_visibility AS ENUM ('public', 'private');
        ALTER TABLE layers ADD COLUMN visibility layer_visibility DEFAULT 'public' NOT NULL;
        RAISE NOTICE 'Added layers.visibility column';
    ELSE
        RAISE NOTICE 'layers.visibility already exists, skipping';
    END IF;
END $$;

-- Sync visibility with is_public for existing layers
UPDATE layers 
SET visibility = CASE 
    WHEN is_public = true THEN 'public'::layer_visibility
    ELSE 'private'::layer_visibility
END
WHERE visibility IS NULL;

-- Create index on workspace_id for faster lookups
CREATE INDEX IF NOT EXISTS idx_layers_workspace_id ON layers(workspace_id);

-- Create index on visibility for filtering
CREATE INDEX IF NOT EXISTS idx_layers_visibility ON layers(visibility);

-- ============================================
-- 4. Create default workspaces for existing users
-- ============================================
-- Note: This creates one workspace per user
-- Workspaces will also be auto-created on first access via API
INSERT INTO workspaces (id, owner_user_id, name, description, created_at, updated_at)
SELECT 
    gen_random_uuid()::text,
    u.id,
    COALESCE(u.username, u.email) || '''s Workspace',
    'Default workspace',
    NOW(),
    NOW()
FROM users u
WHERE NOT EXISTS (
    SELECT 1 FROM workspaces w WHERE w.owner_user_id = u.id
);

-- ============================================
-- 5. Verify migration
-- ============================================
DO $$
DECLARE
    user_count INTEGER;
    workspace_count INTEGER;
    layer_count INTEGER;
BEGIN
    SELECT COUNT(*) INTO user_count FROM users;
    SELECT COUNT(*) INTO workspace_count FROM workspaces;
    SELECT COUNT(*) INTO layer_count FROM layers;
    
    RAISE NOTICE '✅ Migration complete!';
    RAISE NOTICE '   Users: %', user_count;
    RAISE NOTICE '   Workspaces: %', workspace_count;
    RAISE NOTICE '   Layers: %', layer_count;
    
    IF workspace_count < user_count THEN
        RAISE WARNING 'Some users do not have workspaces. They will be created on first API access.';
    END IF;
END $$;

COMMIT;

-- ============================================
-- Rollback script (if needed)
-- ============================================
-- To rollback this migration, run:
--
-- BEGIN;
-- ALTER TABLE layers DROP COLUMN IF EXISTS workspace_id;
-- ALTER TABLE layers DROP COLUMN IF EXISTS visibility;
-- DROP TYPE IF EXISTS layer_visibility;
-- DROP TABLE IF EXISTS workspaces CASCADE;
-- ALTER TABLE users DROP COLUMN IF EXISTS provider_sub;
-- ALTER TABLE users DROP COLUMN IF EXISTS plan;
-- DROP TYPE IF EXISTS user_plan;
-- COMMIT;

