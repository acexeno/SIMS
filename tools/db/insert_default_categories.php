<?php
$projectRoot = __DIR__;
require_once $projectRoot . '/backend/config/database.php';
$pdo = get_db_connection();
$sql = "INSERT INTO component_categories (name) VALUES
  ('CPU'),
  ('Motherboard'),
  ('GPU'),
  ('RAM'),
  ('Storage'),
  ('PSU'),
  ('Case'),
  ('Cooler')
ON DUPLICATE KEY UPDATE name = name;";
$pdo->exec($sql);
echo "Default PC component categories inserted.\n";
