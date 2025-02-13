postgres=>
-- create user
CREATE USER eliza WITH PASSWORD 'your_password';

-- switch to eliza role
SET ROLE eliza;

-- create database
CREATE DATABASE eliza;

-- connect to new database
\c eliza

-- create necessary extensions
CREATE EXTENSION IF NOT EXISTS vector;
CREATE EXTENSION IF NOT EXISTS fuzzystrmatch;

-- grant all permissions to eliza
GRANT ALL PRIVILEGES ON DATABASE eliza TO eliza;

-- grant schema permissions
GRANT USAGE ON SCHEMA public TO eliza;
GRANT CREATE ON SCHEMA public TO eliza;

-- add CREATEDB permission to database user
ALTER USER eliza WITH CREATEDB;

-- grant all permissions to specific schema (usually public)
GRANT ALL PRIVILEGES ON ALL TABLES IN SCHEMA public TO eliza;
GRANT ALL PRIVILEGES ON ALL SEQUENCES IN SCHEMA public TO eliza;

-- grant all permissions to future created tables and sequences
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON TABLES TO eliza;
ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL PRIVILEGES ON SEQUENCES TO eliza;

-- if needed, transfer database ownership to eliza
ALTER DATABASE eliza OWNER TO eliza;
