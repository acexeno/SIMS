# Remove all lines before the first header row (with 'Category' and 'DETAILS') in the CSV
input_file = 'components_database_with_images.csv'
output_file = 'components_database_with_images_cleaned.csv'

with open(input_file, encoding='utf-8') as infile:
    lines = infile.readlines()

header_index = None
for i, line in enumerate(lines):
    if 'Category' in line and 'DETAILS' in line:
        header_index = i
        break

if header_index is not None:
    with open(output_file, 'w', encoding='utf-8') as outfile:
        outfile.writelines(lines[header_index:])
    print(f"Cleaned file written to {output_file}")
else:
    print("No valid header row found!")
