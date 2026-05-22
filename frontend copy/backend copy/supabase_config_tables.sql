-- Dynamic configuration + multi-role support (run after supabase_init.sql)

CREATE TABLE IF NOT EXISTS service_definitions (
    service_id TEXT PRIMARY KEY,
    service_kind TEXT NOT NULL CHECK (service_kind IN ('document', 'service')),
    config JSONB NOT NULL DEFAULT '{}'::jsonb,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS workflow_definitions (
    workflow_name TEXT PRIMARY KEY,
    definition JSONB NOT NULL,
    is_active BOOLEAN DEFAULT TRUE,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS app_settings (
    key TEXT PRIMARY KEY,
    value JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_roles (
    user_id TEXT NOT NULL REFERENCES users(user_id) ON DELETE CASCADE,
    role_name TEXT NOT NULL REFERENCES roles(role_name) ON DELETE CASCADE,
    assigned_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, role_name)
);

ALTER TABLE roles ADD COLUMN IF NOT EXISTS departments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS priority INT DEFAULT 0;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS can_assign_roles BOOLEAN DEFAULT FALSE;
ALTER TABLE roles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE roles ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS idx_service_definitions_active ON service_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_workflow_definitions_active ON workflow_definitions(is_active);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_id ON user_roles(user_id);

-- RLS off: backend accesses these with service/anon key; enable policies in production if needed.
