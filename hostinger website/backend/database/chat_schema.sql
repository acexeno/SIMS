-- Enhanced Chat Support Schema (Safe to run, does not affect existing tables)

CREATE TABLE IF NOT EXISTS chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT DEFAULT NULL, -- NULL for guests
    guest_name VARCHAR(100) DEFAULT NULL,
    guest_email VARCHAR(100) DEFAULT NULL,
    status ENUM('open', 'resolved') DEFAULT 'open',
    priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal',
    resolution_notes TEXT DEFAULT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    INDEX idx_status (status),
    INDEX idx_priority (priority),
    INDEX idx_updated_at (updated_at)
);

CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    sender ENUM('user', 'admin', 'ai') NOT NULL,
    message TEXT NOT NULL,
    message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text',
    read_status ENUM('unread', 'read') DEFAULT 'unread',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE,
    INDEX idx_session_sender (session_id, sender),
    INDEX idx_read_status (read_status),
    INDEX idx_sent_at (sent_at)
);

CREATE TABLE IF NOT EXISTS last_seen_chat (
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);

-- Add missing columns if they don't exist (safe to run multiple times)
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS priority ENUM('low', 'normal', 'high', 'urgent') DEFAULT 'normal' AFTER status,
ADD COLUMN IF NOT EXISTS resolution_notes TEXT DEFAULT NULL AFTER priority;

ALTER TABLE chat_messages 
ADD COLUMN IF NOT EXISTS message_type ENUM('text', 'image', 'file', 'system') DEFAULT 'text' AFTER message,
ADD COLUMN IF NOT EXISTS read_status ENUM('unread', 'read') DEFAULT 'unread' AFTER message_type;

-- Ensure sender column includes AI assistant role
ALTER TABLE chat_messages 
MODIFY COLUMN sender ENUM('user', 'admin', 'ai') NOT NULL;

-- Add indexes if they don't exist
CREATE INDEX IF NOT EXISTS idx_status ON chat_sessions (status);
CREATE INDEX IF NOT EXISTS idx_priority ON chat_sessions (priority);
CREATE INDEX IF NOT EXISTS idx_updated_at ON chat_sessions (updated_at);
CREATE INDEX IF NOT EXISTS idx_session_sender ON chat_messages (session_id, sender);
CREATE INDEX IF NOT EXISTS idx_read_status ON chat_messages (read_status);
CREATE INDEX IF NOT EXISTS idx_sent_at ON chat_messages (sent_at); 