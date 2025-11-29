-- Build Comments Table
CREATE TABLE IF NOT EXISTS build_comments (
    id INT AUTO_INCREMENT PRIMARY KEY,
    build_id INT NOT NULL,
    user_id INT NOT NULL,
    parent_id INT NULL, -- For nested replies
    comment_text TEXT NOT NULL,
    is_approved TINYINT(1) DEFAULT 1, -- For moderation
    is_edited TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (build_id) REFERENCES user_builds(id) ON DELETE CASCADE,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (parent_id) REFERENCES build_comments(id) ON DELETE CASCADE,
    INDEX idx_build_id (build_id),
    INDEX idx_user_id (user_id),
    INDEX idx_parent_id (parent_id),
    INDEX idx_created_at (created_at),
    INDEX idx_is_approved (is_approved)
);

-- Create a view for comment statistics
CREATE OR REPLACE VIEW build_comment_stats AS
SELECT 
    build_id,
    COUNT(*) as total_comments,
    COUNT(CASE WHEN is_approved = 1 THEN 1 END) as approved_comments,
    COUNT(CASE WHEN parent_id IS NULL THEN 1 END) as top_level_comments,
    MAX(created_at) as last_comment_at
FROM build_comments
GROUP BY build_id;
