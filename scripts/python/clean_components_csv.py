import csv

INPUT_CSV = 'components_database_with_images.csv'
OUTPUT_CSV = 'components_database_with_images_cleaned.csv'

with open(INPUT_CSV, newline='', encoding='utf-8') as infile:
    reader = csv.reader(infile)
    header = None
    rows = []
    for row in reader:
        # Find the first row with 'Category' and 'DETAILS' as header
        if not header and 'Category' in row and 'DETAILS' in row:
            header = row
            rows.append(row)
        elif header:
            rows.append(row)

if not header:
    print('No valid header found!')
else:
    with open(OUTPUT_CSV, 'w', newline='', encoding='utf-8') as outfile:
        writer = csv.writer(outfile)
        writer.writerows(rows)
    print(f'Cleaned CSV written to {OUTPUT_CSV}')
