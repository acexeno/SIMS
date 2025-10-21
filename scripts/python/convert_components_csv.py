import csv

input_file = 'components_database.csv'
output_file = 'components_for_import.csv'

with open(input_file, newline='', encoding='utf-8') as infile, open(output_file, 'w', newline='', encoding='utf-8') as outfile:
    reader = csv.reader(infile)
    # Skip the first line (notes)
    next(reader)
    raw_header = next(reader)
    # Normalize header: strip spaces and lowercase
    header = [h.strip().lower() for h in raw_header]
    
    # Build a mapping from normalized header to index
    header_map = {h: i for i, h in enumerate(header)}
    
    def get_col(row, key):
        # Try exact, then try with spaces removed
        key_norm = key.strip().lower()
        for k in header_map:
            if k == key_norm or k.replace(' ', '') == key_norm.replace(' ', ''):
                idx = header_map[k]
                return row[idx].strip() if idx < len(row) else ''
        return ''

    fieldnames = ['name', 'category', 'brand', 'price']
    writer = csv.DictWriter(outfile, fieldnames=fieldnames)
    writer.writeheader()
    
    for row in reader:
        name = get_col(row, 'DETAILS')
        category = get_col(row, 'Category')
        brand = get_col(row, 'BRAND')
        price = get_col(row, 'VAT-INC (SRP)').replace('₱', '').replace(',', '').strip()
        if name and category and brand and price:
            writer.writerow({'name': name, 'category': category, 'brand': brand, 'price': price})

print(f"Conversion complete. Output written to {output_file}") 