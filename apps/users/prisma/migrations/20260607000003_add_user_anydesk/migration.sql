-- Add optional AnyDesk field to users
ALTER TABLE users.users ADD COLUMN IF NOT EXISTS "anydesk" TEXT;
