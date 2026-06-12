-- Migration: add rald_id column to users table
-- Phase 1 of RALD SSO bridge (additive — no data loss risk)
-- Apply manually if drizzle-kit push is unavailable:
--   psql $DATABASE_URL -f 0010_rald_id_column.sql

ALTER TABLE users ADD COLUMN IF NOT EXISTS rald_id TEXT UNIQUE;
