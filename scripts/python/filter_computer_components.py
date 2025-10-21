import csv

# Mapping from CSV category to component_categories.id
CATEGORY_MAP = {
    'CPU': 1,
    'Motherboard': 2,
    'GPU': 3,
    'RAM': 4,
    'Storage': 5,
    'PSU': 6,
    'Case Gaming': 7,
    'Case Generic': 7,
    'AIO': 8,
    'Cooler Fan': 8,
    'Cooler': 8,
}

# Output columns in the order of the MySQL table (excluding id, created_at, updated_at)
OUTPUT_COLUMNS = [
    'name', 'category_id', 'brand', 'model', 'price', 'stock_quantity', 'min_stock_level', 'image_url', 'specs',
    'socket', 'cores', 'threads', 'tdp', 'ram_type', 'form_factor', 'memory', 'speed', 'capacity', 'wattage',
    'efficiency', 'fans', 'type', 'warranty', 'is_active'
]

INPUT_CSV = 'components_database.csv'
OUTPUT_CSV = 'filtered_components_for_import.csv'

with open(INPUT_CSV, newline='', encoding='utf-8') as infile, open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as outfile:
    reader = csv.reader(infile)
    writer = csv.writer(outfile)

    # Find the header row (look for a column containing 'category', case-insensitive)
    header = None
    for row in reader:
        lowered = [col.lower() for col in row]
        if any('category' in col for col in lowered):
            header = row
            break
    if header is None:
        raise Exception('No header row with a Category column found in CSV!')

    # Find column indices for relevant fields (case-insensitive)
    col_map = {col.strip().lower(): i for i, col in enumerate(header)}
    def get(colname):
        return col_map.get(colname.lower(), None)

    # Write output header (for reference, not used by MySQL import)
    writer.writerow(OUTPUT_COLUMNS)

    for row in reader:
        if len(row) < len(header):
            continue  # skip incomplete rows
        category = row[get('category')].strip()
        name = row[get('details')] if get('details') is not None else row[get('name')] if get('name') is not None else ''
        # Skip warranty rows
        if 'warranty' in category.lower() or 'warranty' in name.lower():
            continue
        if category not in CATEGORY_MAP:
            continue
        # Map fields from CSV to output columns
        out = []
        # name
        out.append(name)
        # category_id
        out.append(CATEGORY_MAP[category])
        # brand
        out.append(row[get('brand')] if get('brand') is not None else '')
        # model
        out.append(row[get('model')] if get('model') is not None else '')
        # price (use VAT-INC (SRP) or VAT-EX (SPCL) if available)
        price = ''
        for price_col in ['vat-inc (srp)', 'vat-ex (spcl)', 'vat-ex (reseller)']:
            idx = get(price_col)
            if idx is not None and row[idx].replace('\u20b1','').replace(',','').replace('.00','').strip():
                price = row[idx].replace('\u20b1','').replace(',','').replace('.00','').strip()
                break
        out.append(price)
        # stock_quantity
        out.append('10')
        # min_stock_level
        out.append('5')
        # image_url
        out.append(row[get('url')] if get('url') is not None else '')
        # specs (leave blank for now)
        out.append('')
        # socket
        out.append(row[get('socket')] if get('socket') is not None else '')
        # cores
        out.append(row[get('cores')] if get('cores') is not None else '')
        # threads
        out.append(row[get('threads')] if get('threads') is not None else '')
        # tdp
        out.append(row[get('tdp')] if get('tdp') is not None else '')
        # ram_type
        out.append(row[get('ram_type')] if get('ram_type') is not None else '')
        # form_factor
        out.append(row[get('form_factor')] if get('form_factor') is not None else '')
        # memory
        out.append(row[get('memory')] if get('memory') is not None else '')
        # speed
        out.append(row[get('speed')] if get('speed') is not None else '')
        # capacity
        out.append(row[get('capacity')] if get('capacity') is not None else '')
        # wattage
        out.append(row[get('wattage')] if get('wattage') is not None else '')
        # efficiency
        out.append(row[get('efficiency')] if get('efficiency') is not None else '')
        # fans
        out.append(row[get('fans')] if get('fans') is not None else '')
        # type
        out.append(row[get('type')] if get('type') is not None else '')
        # warranty
        out.append(row[get('warranty')] if get('warranty') is not None else '')
        # is_active
        out.append('1')
        writer.writerow(out)

print(f'Filtered computer components for import written to {OUTPUT_CSV}') 