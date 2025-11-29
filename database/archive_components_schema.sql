-- Archive table for deleted components
-- This table stores components that were deleted from the inventory
-- Components are moved here instead of being permanently deleted
-- This allows recovery if needed

CREATE TABLE IF NOT EXISTS archive_components (
    -- Primary key for archive table
    id INT AUTO_INCREMENT PRIMARY KEY,
    
    -- Original component ID (from components table before deletion)
    original_id INT NOT NULL,
    
    -- All columns from components table
    name VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT DEFAULT 0,
    min_stock_level INT DEFAULT 5,
    image_url VARCHAR(500),
    specs LONGTEXT,
    socket VARCHAR(50),
    cores INT,
    threads INT,
    tdp INT,
    ram_type VARCHAR(20),
    form_factor VARCHAR(20),
    memory VARCHAR(50),
    speed VARCHAR(20),
    capacity VARCHAR(50),
    wattage INT,
    efficiency VARCHAR(20),
    fans INT,
    type VARCHAR(50),
    warranty VARCHAR(100) NULL,
    is_active TINYINT(1) DEFAULT 1,
    
    -- Archive-specific metadata
    deleted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    deleted_by INT NULL, -- User ID who deleted the component
    created_at TIMESTAMP NULL, -- Original creation timestamp
    updated_at TIMESTAMP NULL, -- Last update timestamp before deletion
    
    INDEX idx_original_id (original_id),
    INDEX idx_deleted_at (deleted_at),
    INDEX idx_category_id (category_id),
    FOREIGN KEY (category_id) REFERENCES component_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
