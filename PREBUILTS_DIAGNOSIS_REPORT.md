# Prebuilts Diagnosis Report

## Issue Summary
Only **1 prebuilt PC** exists in the database (AMD Starter), and **no Intel prebuilts** are available.

## Root Causes Identified

### 1. **No Intel CPUs in Database**
- The database contains **15 CPUs total**, but **0 Intel CPUs** were detected
- All CPUs are AMD Ryzen processors
- One CPU named "i7-11700" exists but doesn't contain "Intel" in its name, so it's not detected as Intel

### 2. **CPU Naming Inconsistency**
- Most AMD CPUs don't follow standard naming conventions
- Examples:
  - ✅ Good: "AMD Ryzen 5 5600"
  - ❌ Bad: "R5 5600X (TRAY) WITH HEATSINK FAN"
  - ❌ Bad: "R7 5700X3D 8 CORE 16 THREADS 3.0/4.1 GHZ AM4 W/OUT COOLER"
- The seeding script looks for "AMD" or "Ryzen" in the CPU name, but many CPUs only have "R5", "R7", etc.

### 3. **Missing Motherboard Socket Information**
- **54 out of 56 motherboards** have "Unknown" or empty socket information
- Only **1 motherboard** has "AM4" socket specified
- This prevents the prebuilts generation script from matching CPUs with compatible motherboards

### 4. **Limited Compatibility Matching**
- The prebuilts generation requires:
  1. CPU with known socket
  2. Compatible motherboard with matching socket
  3. All other components (GPU, RAM, Storage, PSU, Case, Cooler)
- With only 1 motherboard having socket info, only 1 prebuilt can be generated

## Current Database State

- **Prebuilts**: 1 (AMD Starter)
- **CPUs**: 15 total (all AMD-based, naming issues)
- **Motherboards**: 56 total (54 without socket info)
- **GPUs**: 17 available
- **RAM**: 34 available
- **Storage**: 39 available
- **PSUs**: 27 available
- **Cases**: 84 available
- **Coolers**: 36 available

## Recommendations

### Immediate Fixes

1. **Update CPU names** to include proper brand identifiers:
   - Change "R5 5600X" → "AMD Ryzen 5 5600X"
   - Change "i7-11700" → "Intel Core i7-11700"

2. **Populate motherboard socket information**:
   - Update motherboards to include correct socket types (AM4, AM5, LGA1700, LGA1200, etc.)

3. **Add Intel CPUs** to the database if you want Intel prebuilts

4. **Re-run prebuilts seeding** after fixing component data

### Long-term Fixes

1. **Improve CPU detection logic** in the seeding script to handle various naming formats
2. **Enforce data validation** during component import to ensure required fields are filled
3. **Add socket validation** to ensure CPU-motherboard compatibility is verifiable

## Next Steps

1. Fix motherboard socket data
2. Standardize CPU naming
3. Add Intel CPUs if needed
4. Re-seed prebuilts

