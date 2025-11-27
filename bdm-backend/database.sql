-- Create Database
CREATE DATABASE IF NOT EXISTS bdm_system;
USE bdm_system;

-- Clauses Table
CREATE TABLE clauses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    clause_type VARCHAR(50) NOT NULL COMMENT 'header, greeting, body, signature, etc.',
    content TEXT NOT NULL,
    category VARCHAR(100) COMMENT 'offer_letter, contract, nda, etc.',
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_clause_type (clause_type),
    INDEX idx_category (category)
);

-- Templates Table
CREATE TABLE templates (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL COMMENT 'offer_letter, employment_contract, nda, etc.',
    description TEXT,
    clause_order JSON COMMENT 'Array of clause IDs in order',
    is_ai_generated BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_document_type (document_type)
);

-- Template Clauses Mapping (Many-to-Many relationship)
CREATE TABLE template_clauses (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT NOT NULL,
    clause_id INT NOT NULL,
    position INT NOT NULL COMMENT 'Order position in template',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE CASCADE,
    FOREIGN KEY (clause_id) REFERENCES clauses(id) ON DELETE CASCADE,
    UNIQUE KEY unique_template_clause (template_id, clause_id),
    INDEX idx_template_id (template_id),
    INDEX idx_position (position)
);

-- Documents Table (Generated final documents)
CREATE TABLE documents (
    id INT PRIMARY KEY AUTO_INCREMENT,
    template_id INT,
    document_name VARCHAR(255) NOT NULL,
    document_type VARCHAR(100) NOT NULL,
    content_json JSON COMMENT 'Complete document with filled data',
    variables JSON COMMENT 'Dynamic data used to fill template',
    pdf_path VARCHAR(500),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (template_id) REFERENCES templates(id) ON DELETE SET NULL,
    INDEX idx_document_type (document_type),
    INDEX idx_created_at (created_at)
);

-- AI Generation Logs (Track AI usage)
CREATE TABLE ai_generation_logs (
    id INT PRIMARY KEY AUTO_INCREMENT,
    request_type VARCHAR(50) COMMENT 'clause, template, document',
    prompt TEXT,
    response_data JSON,
    tokens_used INT,
    cost_estimate DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    INDEX idx_request_type (request_type),
    INDEX idx_created_at (created_at)
);
-- Translations table: stores translated versions of clauses/templates/documents
CREATE TABLE IF NOT EXISTS translations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  original_id INT NOT NULL,                      -- id from clauses/templates/documents
  original_type VARCHAR(32) NOT NULL,            -- 'clause' | 'template' | 'document'
  lang CHAR(2) NOT NULL,                         -- ISO 639-1 e.g. 'en','es','fr'
  content TEXT NOT NULL,                         -- translated content (HTML/markdown/plain)
  status VARCHAR(20) DEFAULT 'generated',        -- 'generated' | 'confirmed' | 'rejected'
  created_by INT NULL,                           -- optional user id who generated/confirmed
  verified_by INT NULL,                          -- optional user id who verified
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_original_lang (original_id, original_type, lang),
  INDEX idx_original (original_type, original_id),
  INDEX idx_lang (lang),
  INDEX idx_status (status)
);

-- Preview tokens: temporary store so frontend must preview before confirm/download
CREATE TABLE IF NOT EXISTS translation_previews (
  preview_id VARCHAR(128) PRIMARY KEY,           -- UUID or secure random string
  original_id INT NOT NULL,
  original_type VARCHAR(32) NOT NULL,
  lang CHAR(2) NOT NULL,
  translated_content TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  INDEX idx_expires_at (expires_at)
);

-- Check if tables exist
SHOW TABLES LIKE 'translations';
SHOW TABLES LIKE 'translation_previews';

-- If they don't exist, create them:
CREATE TABLE IF NOT EXISTS translations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  original_id INT NOT NULL,
  original_type VARCHAR(32) NOT NULL,
  lang CHAR(2) NOT NULL,
  content TEXT NOT NULL,
  status VARCHAR(20) DEFAULT 'generated',
  created_by INT NULL,
  verified_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_original_lang (original_id, original_type, lang),
  INDEX idx_original (original_type, original_id),
  INDEX idx_lang (lang),
  INDEX idx_status (status)
);

CREATE TABLE IF NOT EXISTS translation_previews (
  preview_id VARCHAR(128) PRIMARY KEY,
  original_id INT NOT NULL,
  original_type VARCHAR(32) NOT NULL,
  lang CHAR(2) NOT NULL,
  translated_content TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  expires_at TIMESTAMP NULL,
  confirmed BOOLEAN DEFAULT FALSE,
  INDEX idx_expires_at (expires_at)
);
-- Insert sample data for testing
INSERT INTO clauses (clause_type, content, category, is_ai_generated) VALUES
('header', 'COMPANY LETTERHEAD\n[Company Name]\n[Company Address]\n[City, State ZIP]', 'offer_letter', FALSE),
('greeting', 'Dear [Candidate Name],', 'offer_letter', FALSE),
('closing', 'We look forward to welcoming you to our team.\n\nSincerely,\n[Sender Name]\n[Sender Title]', 'offer_letter', FALSE);