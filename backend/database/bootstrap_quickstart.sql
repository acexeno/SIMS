-- SIMS (BuildIt PC) Quickstart Bootstrap Schema + Minimal Seed
-- Usage:
-- 1) Local (XAMPP): create database builditpc_db; select it in phpMyAdmin, then import this file.
-- 2) Hostinger: select your database (e.g., u709288172_builditpc_db) in phpMyAdmin, then import this file.
--    Do NOT run CREATE DATABASE there unless you intend to.

SET NAMES utf8mb4;
SET FOREIGN_KEY_CHECKS=0;

-- Core tables ---------------------------------------------------------------
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    email VARCHAR(100) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    first_name VARCHAR(100) NOT NULL,
    last_name VARCHAR(100) NOT NULL,
    phone VARCHAR(20),
    country VARCHAR(100) DEFAULT 'Philippines',
    is_active TINYINT(1) DEFAULT 1,
    profile_image VARCHAR(500),
    last_login DATETIME,
    can_access_inventory TINYINT(1) NOT NULL DEFAULT 1,
    can_access_orders TINYINT(1) NOT NULL DEFAULT 1,
    can_access_chat_support TINYINT(1) NOT NULL DEFAULT 1,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS roles (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_roles (
    user_id INT NOT NULL,
    role_id INT NOT NULL,
    PRIMARY KEY (user_id, role_id),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
    FOREIGN KEY (role_id) REFERENCES roles(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS component_categories (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS components (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category_id INT NOT NULL,
    brand VARCHAR(100),
    model VARCHAR(100),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
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
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (category_id) REFERENCES component_categories(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_builds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT,
    components JSON NOT NULL,
    compatibility_score INT DEFAULT 0,
    total_price DECIMAL(10,2) DEFAULT 0.00,
    is_public TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS orders (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    order_date DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(50) NOT NULL DEFAULT 'pending',
    total DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    total_price DECIMAL(12,2) NOT NULL DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS order_items (
    id INT AUTO_INCREMENT PRIMARY KEY,
    order_id INT NOT NULL,
    component_id INT NOT NULL,
    quantity INT NOT NULL DEFAULT 1,
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    FOREIGN KEY (order_id) REFERENCES orders(id) ON DELETE CASCADE,
    FOREIGN KEY (component_id) REFERENCES components(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS prebuilts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    category VARCHAR(100) NOT NULL,
    description TEXT,
    image VARCHAR(500),
    price DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    performance JSON,
    features JSON,
    component_ids JSON,
    in_stock TINYINT(1) DEFAULT 1,
    is_hidden TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Chat + notifications (optional but recommended for full feature set) -----
CREATE TABLE IF NOT EXISTS chat_sessions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NULL,
    guest_name VARCHAR(100) NULL,
    guest_email VARCHAR(150) NULL,
    status ENUM('open','resolved') DEFAULT 'open',
    priority ENUM('low','normal','high','urgent') DEFAULT 'normal',
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS chat_messages (
    id INT AUTO_INCREMENT PRIMARY KEY,
    session_id INT NOT NULL,
    sender ENUM('user','admin') NOT NULL,
    message TEXT NOT NULL,
    message_type ENUM('text','image','file','system') DEFAULT 'text',
    read_status ENUM('unread','read') DEFAULT 'unread',
    sent_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (session_id) REFERENCES chat_sessions(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS last_seen_chat (
    user_id INT NOT NULL,
    session_id INT NOT NULL,
    last_seen_at DATETIME NOT NULL,
    PRIMARY KEY (user_id, session_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_id INT NOT NULL,
    type VARCHAR(50) NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT,
    priority VARCHAR(20) DEFAULT 'low',
    is_read TINYINT(1) DEFAULT 0,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Seed roles and categories -------------------------------------------------
INSERT INTO roles (name) VALUES ('Client'), ('Employee'), ('Admin'), ('Super Admin')
    ON DUPLICATE KEY UPDATE name = VALUES(name);

INSERT INTO component_categories (name) VALUES
('CPU'), ('Motherboard'), ('GPU'), ('RAM'), ('Storage'), ('PSU'), ('Case'), ('Cooler')
    ON DUPLICATE KEY UPDATE name = VALUES(name);

-- Minimal demo components (adjust image paths as needed) --------------------
-- Assumes your images are available under /images/... in your hosting root.
INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, socket)
SELECT 'AMD Ryzen 5 5600G', id, 'AMD', '5600G', 7995.00, 5, '/images/components/cpu/ryzen5600g.png', '{"cores":6,"threads":12,"base_clock":"3.9GHz"}', 'AM4'
FROM component_categories WHERE name='CPU'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, socket)
SELECT 'ASRock B550M Pro4', id, 'ASRock', 'B550M PRO4', 5490.00, 4, '/images/components/motherboard/b550m_pro4.png', '{"form_factor":"mATX","ram_type":"DDR4"}', 'AM4'
FROM component_categories WHERE name='Motherboard'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, memory)
SELECT 'GIGABYTE RTX 4070 SUPER EAGLE OC 12GB', id, 'GIGABYTE', 'RTX 4070 SUPER EAGLE OC', 45718.00, 2, '/images/components/gpu/GIGABYTE RTX 4070 SUPER OC 12GB WHITE.png', '{"boost_clock":"2.5GHz"}', '12GB'
FROM component_categories WHERE name='GPU'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, capacity)
SELECT 'G.SKILL Aegis 16GB (2x8GB) DDR4-3200', id, 'G.SKILL', 'Aegis', 1995.00, 10, '/images/components/ram/gskill_aegis_16gb.png', '{"speed":"3200MHz"}', '16GB'
FROM component_categories WHERE name='RAM'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, capacity)
SELECT 'Kingston NV2 500GB NVMe SSD', id, 'Kingston', 'NV2 500GB', 1690.00, 12, '/images/components/storage/kingston_nv2_500gb.png', '{"type":"NVMe"}', '500GB'
FROM component_categories WHERE name='Storage'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, wattage)
SELECT 'Cooler Master MWE 650W 80+ Bronze', id, 'Cooler Master', 'MWE 650', 2490.00, 7, '/images/components/psu/cm_mwe_650.png', '{"efficiency":"80+ Bronze"}', 650
FROM component_categories WHERE name='PSU'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs)
SELECT 'NZXT H510', id, 'NZXT', 'H510', 2990.00, 3, '/images/components/case/nzxt_h510.png', '{"form_factor":"ATX"}'
FROM component_categories WHERE name='Case'
ON DUPLICATE KEY UPDATE name=name;

INSERT INTO components (name, category_id, brand, model, price, stock_quantity, image_url, specs, type)
SELECT 'DeepCool Gammaxx GTE V2', id, 'DeepCool', 'GTE V2', 1290.00, 6, '/images/components/cooler/gammaxx_gte_v2.png', '{"type":"Air"}', 'Air'
FROM component_categories WHERE name='Cooler'
ON DUPLICATE KEY UPDATE name=name;

SET FOREIGN_KEY_CHECKS=1;
