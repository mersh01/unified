-- Create users table for authentication and role management
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR UNIQUE NOT NULL,
    username VARCHAR UNIQUE,
    email VARCHAR UNIQUE,
    phone_number VARCHAR UNIQUE NOT NULL,
    full_name VARCHAR NOT NULL,
    role VARCHAR NOT NULL DEFAULT 'citizen',
    department VARCHAR,
    is_active BOOLEAN DEFAULT TRUE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_login TIMESTAMP WITH TIME ZONE,
    hierarchy_country VARCHAR,
    hierarchy_region VARCHAR,
    hierarchy_zone VARCHAR,
    hierarchy_woreda VARCHAR,
    hierarchy_kebele VARCHAR,
    password_hash VARCHAR
);

-- Create roles table for role definitions
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR NOT NULL,
    description TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    is_system_role BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default roles
INSERT INTO roles (role_name, display_name, description, permissions, is_system_role) VALUES
('super_admin', 'Super Administrator', 'Full system access', '["*"]'::jsonb, true),
('system_admin', 'System Administrator', 'System configuration and user management', '["manage_users", "manage_roles", "view_system_reports", "configure_system"]'::jsonb, true),
('verification_officer', 'Verification Officer', 'Process document verification', '["view_assigned_applications", "verify_documents", "update_application_status", "add_comments"]'::jsonb, false),
('verification_supervisor', 'Verification Supervisor', 'Supervise verification officers', '["view_team_applications", "verify_documents", "update_application_status", "manage_team", "escalate_applications"]'::jsonb, false),
('senior_verifier', 'Senior Verifier', 'Handle complex verifications', '["view_all_applications", "verify_documents", "update_application_status", "escalate_applications", "override_decisions"]'::jsonb, false),
('document_verifier', 'Document Specialist', 'Specialized document verification', '["view_assigned_applications", "verify_documents", "request_additional_docs"]'::jsonb, false),
('document_specialist', 'Document Specialist', 'Advanced document processing', '["view_assigned_applications", "verify_documents", "flag_fraud", "request_additional_docs"]'::jsonb, false),
('payment_officer', 'Payment Officer', 'Handle payment processing', '["view_payment_applications", "process_payments", "refund_payments", "view_payment_reports"]'::jsonb, false),
('issuance_officer', 'Certificate Officer', 'Issue certificates and documents', '["view_ready_applications", "issue_certificates", "generate_tracking_ids", "print_documents"]'::jsonb, false),
('quality_checker', 'Quality Checker', 'Final quality assurance', '["view_completed_applications", "quality_check", "flag_issues", "approve_final"]'::jsonb, false),
('citizen', 'Citizen', 'Regular user submitting applications', '["submit_applications", "view_own_applications", "track_applications"]'::jsonb, true)
ON CONFLICT (role_name) DO NOTHING;

-- Create localization table for dynamic translations
CREATE TABLE IF NOT EXISTS localization_definitions (
    id SERIAL PRIMARY KEY,
    locale VARCHAR UNIQUE NOT NULL,
    display_name VARCHAR NOT NULL,
    translations JSONB NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create applications table for Supabase
CREATE TABLE IF NOT EXISTS applications (
    id SERIAL PRIMARY KEY,
    application_id VARCHAR UNIQUE NOT NULL,
    document_type VARCHAR,
    user_id VARCHAR NOT NULL REFERENCES users(user_id),
    user_name VARCHAR NOT NULL,
    user_email VARCHAR NOT NULL,
    user_phone VARCHAR,
    form_data JSONB NOT NULL,
    current_state VARCHAR DEFAULT 'SUBMITTED',
    status VARCHAR DEFAULT 'PENDING',
    fee_amount FLOAT DEFAULT 0,
    fee_paid BOOLEAN DEFAULT FALSE,
    payment_id VARCHAR,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    processed_at TIMESTAMP WITH TIME ZONE,
    completed_at TIMESTAMP WITH TIME ZONE,
    tracking_id VARCHAR,
    rejection_reason TEXT,
    history JSONB DEFAULT '[]'::jsonb,
    hierarchy_country VARCHAR,
    hierarchy_region VARCHAR,
    hierarchy_zone VARCHAR,
    hierarchy_woreda VARCHAR,
    hierarchy_kebele VARCHAR,
    service_level VARCHAR,
    responsible_hierarchy JSONB,
    department VARCHAR,
    assigned_to VARCHAR REFERENCES users(user_id),
    assigned_at TIMESTAMP WITH TIME ZONE,
    priority VARCHAR DEFAULT 'normal'
);

-- Create user_sessions table for session management
CREATE TABLE IF NOT EXISTS user_sessions (
    id SERIAL PRIMARY KEY,
    session_id VARCHAR UNIQUE NOT NULL,
    user_id VARCHAR NOT NULL REFERENCES users(user_id),
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    expires_at TIMESTAMP WITH TIME ZONE,
    is_active BOOLEAN DEFAULT TRUE
);

-- Create audit_logs table for admin actions
CREATE TABLE IF NOT EXISTS audit_logs (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR REFERENCES users(user_id),
    action VARCHAR NOT NULL,
    resource_type VARCHAR NOT NULL,
    resource_id VARCHAR,
    details JSONB,
    ip_address VARCHAR,
    user_agent TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable Row Level Security (RLS)
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs ENABLE ROW LEVEL SECURITY;

-- Create policies for users table
CREATE POLICY "Users can view their own profile" ON users
FOR SELECT USING (auth.uid()::text = user_id OR role IN ('super_admin', 'system_admin'));

CREATE POLICY "Admins can manage users" ON users
FOR ALL USING (EXISTS (
    SELECT 1 FROM users u WHERE u.user_id = auth.uid()::text 
    AND u.role IN ('super_admin', 'system_admin')
));

-- Create policies for roles table
CREATE POLICY "Authenticated users can view roles" ON roles
FOR SELECT USING (auth.role() = 'authenticated');

CREATE POLICY "Admins can manage roles" ON roles
FOR ALL USING (EXISTS (
    SELECT 1 FROM users u WHERE u.user_id = auth.uid()::text 
    AND u.role IN ('super_admin', 'system_admin')
));

-- Create policies for applications table
CREATE POLICY "Users can view their own applications" ON applications
FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "Users can create applications" ON applications
FOR INSERT WITH CHECK (user_id = auth.uid()::text);

CREATE POLICY "Assigned officers can update applications" ON applications
FOR UPDATE USING (
    assigned_to = auth.uid()::text OR 
    EXISTS (SELECT 1 FROM users u WHERE u.user_id = auth.uid()::text AND u.role IN ('super_admin', 'system_admin'))
);

-- Create policies for audit_logs table
CREATE POLICY "Admins can view audit logs" ON audit_logs
FOR SELECT USING (EXISTS (
    SELECT 1 FROM users u WHERE u.user_id = auth.uid()::text 
    AND u.role IN ('super_admin', 'system_admin')
));

CREATE POLICY "System can insert audit logs" ON audit_logs
FOR INSERT WITH CHECK (true);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_users_user_id ON users(user_id);
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_applications_user_id ON applications(user_id);
CREATE INDEX IF NOT EXISTS idx_applications_current_state ON applications(current_state);
CREATE INDEX IF NOT EXISTS idx_applications_assigned_to ON applications(assigned_to);
CREATE INDEX IF NOT EXISTS idx_applications_created_at ON applications(created_at);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user_id ON audit_logs(user_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created_at ON audit_logs(created_at);

-- Insert default admin user (change password after first login)
INSERT INTO users (user_id, username, email, phone_number, full_name, role, department, password_hash)
VALUES ('ADMIN_001', 'admin', 'admin@system.local', '0000000000', 'System Administrator', 'super_admin', 'IT', '$2b$12$adEE3ZTkWJ58fX26XzMWP.2tUqeJUXPZi.hnuMlPAV9sO5uUKKPh.')
ON CONFLICT (user_id) DO NOTHING;

-- Create notifications table
CREATE TABLE IF NOT EXISTS notifications (
    id SERIAL PRIMARY KEY,
    user_id VARCHAR NOT NULL REFERENCES users(user_id),
    title VARCHAR NOT NULL,
    message TEXT NOT NULL,
    type VARCHAR NOT NULL,
    related_application_id VARCHAR,
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

ALTER TABLE notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON notifications
FOR SELECT USING (user_id = auth.uid()::text);

CREATE POLICY "System can insert notifications" ON notifications
FOR INSERT WITH CHECK (true);

CREATE POLICY "Users can update their own notifications" ON notifications
FOR UPDATE USING (user_id = auth.uid()::text);

CREATE INDEX IF NOT EXISTS idx_notifications_user_id ON notifications(user_id);
CREATE INDEX IF NOT EXISTS idx_notifications_is_read ON notifications(is_read);

