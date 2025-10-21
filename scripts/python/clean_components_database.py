# This script removes the first line if it is a comment, keeping the header and all data for further processing.
input_file = 'components_database.csv'
output_file = 'components_database_cleaned.csv'

with open(input_file, encoding='utf-8') as infile:
    lines = infile.readlines()

# If the first line is a comment (does not contain 'Category' and 'DETAILS'), remove it
if len(lines) > 1 and not ('Category' in lines[0] and 'DETAILS' in lines[0]):
    lines = lines[1:]

with open(output_file, 'w', encoding='utf-8') as outfile:
    outfile.writelines(lines)

print(f"Cleaned file written to {output_file}")
