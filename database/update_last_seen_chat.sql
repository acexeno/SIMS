-- Drop the existing table if it exists
DROP TABLE IF EXISTS last_seen_chat;

-- Recreate the table with the correct schema
CREATE TABLE last_seen_chat (
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    PRIMARY KEY (user_id, session_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
);
