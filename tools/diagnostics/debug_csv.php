<?php
$csvFile = __DIR__ . '/filtered_components_for_import.csv';
$handle = fopen($csvFile, 'r');
$header = fgetcsv($handle);
$header = array_map('trim', $header);
$idx = array_flip($header);
$line = 1;
while (($row = fgetcsv($handle)) !== false) {
    $line++;
    if (count($row) < count($header)) $row = array_pad($row, count($header), null);
    if (count($row) > count($header)) $row = array_slice($row, 0, count($header));
    $assoc = @array_combine($header, $row);
    if (!$assoc) { echo "line $line: bad_row\n"; continue; }
    $cid = intval($assoc['category_id'] ?? 0);
    if (in_array($cid, [1,2,4])) {
        echo "line $line: cat={$assoc['category_id']} name={$assoc['name']} is_active='" . trim((string)$assoc['is_active']) . "'\n";
    }
}
fclose($handle);
