// Color update utility to replace blue colors with green
// This file contains color mappings for consistent green theme

export const colorMappings = {
  // Blue to Green mappings using the provided color palette
  'blue-500': 'green-500',
  'blue-600': 'green-600', 
  'blue-700': 'green-700',
  'blue-800': 'green-800',
  'blue-900': 'green-900',
  'blue-400': 'green-400',
  'blue-300': 'green-300',
  'blue-200': 'green-200',
  'blue-100': 'green-100',
  'blue-50': 'green-50',
  
  // Indigo to Green mappings
  'indigo-500': 'green-500',
  'indigo-600': 'green-600',
  'indigo-700': 'green-700',
  'indigo-800': 'green-800',
  'indigo-900': 'green-900',
  
  // RGB color mappings using the provided green palette
  'rgb(59, 130, 246)': 'rgb(82, 164, 71)', // blue-500 to medium green (#52a447)
  'rgb(37, 99, 235)': 'rgb(91, 180, 80)',  // blue-600 to slightly lighter medium green (#5bb450)
  'rgb(29, 78, 216)': 'rgb(70, 146, 60)',  // blue-700 to medium-dark green (#46923c)
  'rgb(30, 64, 175)': 'rgb(59, 129, 50)',  // blue-800 to darker green (#3b8132)
  'rgb(30, 58, 138)': 'rgb(39, 98, 33)',  // blue-900 to dark green (#276221)
  
  // Hex color mappings using the provided green palette
  '#3b82f6': '#52a447', // blue-500 to medium green
  '#2563eb': '#5bb450', // blue-600 to slightly lighter medium green
  '#1d4ed8': '#46923c', // blue-700 to medium-dark green
  '#1e40af': '#3b8132', // blue-800 to darker green
  '#1e3a8a': '#276221', // blue-900 to dark green
};

export const updateColors = (text) => {
  let updatedText = text;
  
  // Apply all color mappings
  Object.entries(colorMappings).forEach(([oldColor, newColor]) => {
    const regex = new RegExp(oldColor.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g');
    updatedText = updatedText.replace(regex, newColor);
  });
  
  return updatedText;
};

export default colorMappings;

