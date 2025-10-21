import csv
import os

# Define PC component categories to keep
PC_CATEGORIES = [
    'CPU', 'Processor', 'GPU', 'Graphics Card', 'Motherboard', 'RAM', 'Memory', 'SSD', 'HDD', 'Storage',
    'PSU', 'Power Supply', 'Case', 'Cooler', 'Fan', 'AIO', 'VGA', 'NVMe', 'SATA', 'DDR4', 'DDR5', 'ATX', 'mATX', 'ITX'
]

# Map category names to image subfolders (customize as needed)
CATEGORY_IMAGE_FOLDER = {
    'CPU': 'cpu',
    'Processor': 'cpu',
    'GPU': 'gpu',
    'Graphics Card': 'gpu',
    'Motherboard': 'motherboard',
    'RAM': 'ram',
    'Memory': 'ram',
    'SSD': 'ssd',
    'HDD': 'hdd',
    'Storage': 'storage',
    'PSU': 'psu',
    'Power Supply': 'psu',
    'Case': 'case',
    'Cooler': 'cooler',
    'Fan': 'fan',
    'AIO': 'cooler',
    'VGA': 'gpu',
    'NVMe': 'ssd',
    'SATA': 'ssd',
    'DDR4': 'ram',
    'DDR5': 'ram',
    'ATX': 'motherboard',
    'mATX': 'motherboard',
    'ITX': 'motherboard',
}

INPUT_CSV = 'components_database_cleaned.csv'
OUTPUT_CSV = 'components_database_with_images.csv'
IMAGE_BASE_PATH = '/images/components/'

with open(INPUT_CSV, newline='', encoding='utf-8') as infile, open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as outfile:
    reader = csv.DictReader(infile)
    fieldnames = reader.fieldnames + ['image_url'] if 'image_url' not in reader.fieldnames else reader.fieldnames
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()

    for row in reader:
        category = (row.get('Category') or '').strip()
        brand = (row.get('BRAND') or '').strip()
        name = (row.get('DETAILS') or row.get('name') or '').strip()
        # Combine brand and name for filename if brand exists
        filename = f"{brand} {name}".strip() if brand else name
        # Only keep PC components
        if not any(pc_cat.lower() in category.lower() for pc_cat in PC_CATEGORIES):
            continue
        # Guess image folder
        folder = CATEGORY_IMAGE_FOLDER.get(category, category.lower())
        # Use BRAND + DETAILS as filename, preserve spaces and special characters
        image_file = f"{filename}.png"
        image_url = f"{IMAGE_BASE_PATH}{folder}/{image_file}"
        row['image_url'] = image_url
        writer.writerow(row)

print(f"Done! Output: {OUTPUT_CSV}")
