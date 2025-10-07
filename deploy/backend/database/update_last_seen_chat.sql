-- Drop the existing table if it exists
DROP TABLE IF EXISTS last_seen_chat;

-- Recreate the table with the correct schema
CREATE TABLE last_seen_chat (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    last_seen_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    UNIQUE KEY (user_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);
