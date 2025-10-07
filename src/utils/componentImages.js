// Real computer component images mapping
// Updated to use local images from public/images/components/
// Component names match exactly with the database
// NOTE: In production (served from /capstone2/dist/), absolute paths like
// "/images/..." must be prefixed by Vite's BASE_URL so they resolve to
// "/capstone2/dist/images/...". We handle that centrally via resolveAssetPath.

const BASE_URL = (import.meta && import.meta.env && import.meta.env.BASE_URL) || '/';
const resolveAssetPath = (p) => {
  if (!p) return p;
  const path = p.startsWith('/') ? p.slice(1) : p;
  // If base is './' or empty, return a relative path without leading slash
  if (!BASE_URL || BASE_URL === './') {
    return path;
  }
  // Otherwise, join base (without trailing slash) and normalized path
  const base = BASE_URL.endsWith('/') ? BASE_URL.slice(0, -1) : BASE_URL;
  return `${base}/${path}`;
};

// Deterministic hash for stable fallback image selection (prevents stutter)
const stableIndexFromString = (str, mod) => {
  if (!str || mod <= 0) return 0;
  let h = 5381;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i);
  }
  // Ensure positive and within range
  return Math.abs(h) % mod;
};

const componentImages = {
  // CPU Images - Exact database names
  "R3 3200G (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R3 3200G (TRAY) WITH HEATSINK FAN.png",
  "R5 5600G (TRAY) WITH HEATSINK FAN": "/images/components/cpu/r5_5600G_tray.png",
  "R5 5600GT (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R5 5600GT (TRAY) WITH HEATSINK FAN.png",
  "R5 5600X (box) WITH WRAITH STEALTH COOLER": "/images/components/cpu/R5 5600X (TRAY) WITH HEATSINK FAN.png",
  "R5 5600X (box) WITH WRAITH STEALTH": "/images/components/cpu/R5 5600X (TRAY) WITH HEATSINK FAN.png",
  "R5 5600X (TRAY) NO COOLER": "/images/components/cpu/r5_5600x_tray.png",
  "R5 5600X (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R5 5600X (TRAY) WITH HEATSINK FAN.png",
  "R5 7600X (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R5 7600X (TRAY) WITH HEATSINK FAN.png",
  "R7 4750G (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R7 4750G (TRAY) WITH HEATSINK FAN.png",
  "R7 5700G (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R7 5700G (TRAY) WITH HEATSINK FAN.png",
  "R7 5700X (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R7 5700X (TRAY) WITH HEATSINK FAN.png",
  "R7 5800X (TRAY) WITH HEATSINK FAN": "/images/components/cpu/R7 5800X (TRAY) WITH HEATSINK FAN.png",
  "i7-11700 (plastic blister) + ISF": "/images/components/cpu/i7-11700 (plastic blister).png",
  "R7 5700X3D 8 CORE 16 THREADS 3.0/4.1 GHZ AM4 W/OUT COOLER": "/images/components/cpu/R7 5700X3D (TRAY).png",
  "R7 5700X (TRAY) NO COOLER": "/images/components/cpu/R7 5700X (TRAY) WITH HEATSINK FAN.png",
  
  // GPU Images - Exact database names
  "GALAX RTX 3060 1-CLICK OC BLK 12GB": "/images/components/gpu/GALAX RTX 3060 1-CLICK OC BLK 12GB.png",
  "GALAX RTX 4060 1-CLICK OC BLACK 8GB": "/images/components/gpu/GALAX RTX 4060 1-CLICK OC BLACK 8GB.png",
  "GIGABYTE RTX 4060 AERO OC 8GB WHITE": "/images/components/gpu/GIGABYTE RTX 4060 AERO OC 8GB WHITE.png",
  "GIGABYTE RTX 4060TI AERO OC 16GB WHITE": "/images/components/gpu/GIGABYTE RTX 4060TI AERO OC 16GB WHITE.png",
  "GIGABYTE RTX 4060TI AERO OC 8GB WHITE": "/images/components/gpu/GIGABYTE RTX 4060TI AERO OC 8GB WHITE.png",
  "GIGABYTE RTX 4070 SUPER EAGLE OC 12GB": "/images/components/gpu/GIGABYTE RTX 4070 SUPER EAGLE OC 12GB.png",
  "GIGABYTE RX 6600 8GB EAGLE": "/images/components/gpu/GIGABYTE RX 6600 8GB EAGLE.png",
  "GIGABYTE RX 7600XT GAMING OC 16GB": "/images/components/gpu/GIGABYTE RX 7600XT GAMING OC 16GB.png",
  "PNY VERTO RTX 4060 8GB DUAL FAN OC": "/images/components/gpu/PNY VERTO RTX 4060 8GB DUAL FAN OC.png",
  "RAMSTA RX550 4GB GDDR5": "/images/components/gpu/RAMSTA RX550 4GB GDDR5.png",
  "RAMSTA RX580 8GB GDDR5": "/images/components/gpu/RAMSTA RX580 8GB GDDR5.png",
  "SAPPHIRE PULSE AMD RADEON RX 7800 XT 16GB": "/images/components/gpu/SAPPHIRE PULSE AMD RADEON RX 7800 XT 16GB.png",
  "ASROCK RX 6600 CHALLENGER 8GB WHITE": "/images/components/gpu/ASROCK RX 6600 CHALLENGER 8GB WHITE.png",
  "COLORFUL GEFORCE RTX 3070 BATTLE AX 8GB": "/images/components/gpu/COLORFUL GEFORCE RTX 3070 BATTLE AX 8GB.png",
  "COLORFUL IGAME ULTRA RTX 4060 8GB (WHITE": "/images/components/gpu/COLORFUL IGAME ULTRA RTX 4060 8GB (WHITE.png",
  "GALAX GTX 1650EX PLUS 4GB DDR6": "/images/components/gpu/GALAX GTX 1650EX PLUS 4GB DDR6.png",
  "GALAX RTX 3050 1-CLICK OC BLK 6GB": "/images/components/gpu/GALAX RTX 3050 1-CLICK OC BLK 6GB.png",
  "RX 6600 CHALLENGER 8GB WHITE": "/images/components/gpu/ASROCK RX 6600 CHALLENGER 8GB WHITE.png",
  "RX 7600XT GAMING OC 16GB": "/images/components/gpu/GIGABYTE RX 7600XT GAMING OC 16GB.png",
  
  // RAM Images - Exact database names
  "KINGSTON FURY BEAST DDR4 8GB": "/images/components/ram/KINGSTON FURY BEAST DDR4 8GB.png",
  "KINGSTON FURY BEAST DDR4 16GB (single stick)": "/images/components/ram/KINGSTON FURY BEAST DDR4 16GB (single stick).png",
  "KINGSPEC DDR4 8GB RGB": "/images/components/ram/KINGSPEC DDR4 8GB RGB.png",
  "NEO FORZA FAYE DDR4": "/images/components/ram/NEO FORZA FAYE DDR4.png",
  "NEO FORZA FAYE DDR4 16GB (2X8GB) NON RGB": "/images/components/ram/NEO FORZA FAYE DDR4 16GB (2X8GB) NON RGB.png",
  "SKIHOTAR DDR4 4GB (2666MHz)": "/images/components/ram/SKIHOTAR DDR4 4GB (2666MHz).png",
  "SKIHOTAR DDR4 8GB (3200MHz)": "/images/components/ram/SKIHOTAR DDR4 8GB (3200MHz).png",
  "TEAM ELITE PLUS GOLD DDR4 8GB": "/images/components/ram/TEAM ELITE PLUS GOLD DDR4 8GB.png",
  "TFORCE DDR4 DARKZA 16GB (2x8gb) 3600MHz": "/images/components/ram/TFORCE DDR4 DARKZA 16GB (2x8gb) 3600MHz.png",
  "TFORCE Delta RGB DDR4 16GB kit (2x8gb) 3600MHz BLACK": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) 3600MHz BLACK.png",
  "TFORCE Delta RGB DDR4 16GB kit (2x8gb) 3600MHz WHITE": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) 3600MHz WHITE.png",
  "TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK.png",
  "TFORCE Delta RGB DDR4 16GB kit (2x8gb) WHITE": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) WHITE.png",
  "TFORCE Delta RGB DDR4 32GB kit (2x16gb) BLACK": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) BLACK.png",
  "TFORCE Delta RGB DDR4 32GB kit (2x16gb) WHITE": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) WHITE.png",
  "FURY BEAST DDR4 8gb": "/images/components/ram/KINGSTON FURY BEAST DDR4 8GB.png",
  "FURY BEAST DDR4 16gb (single stick)": "/images/components/ram/KINGSTON FURY BEAST DDR4 16GB (single stick).png",
  "FAYE DDR4 16GB (2X8GB) 3200 NON RGB w/ HS": "/images/components/ram/NEO FORZA FAYE DDR4 16GB (2X8GB) NON RGB.png",
  "DDR4 8GB": "/images/components/ram/SKIHOTAR DDR4 8GB (3200MHz).png",
  "PLUS GOLD DDR4  8GB": "/images/components/ram/TEAM ELITE PLUS GOLD DDR4 8GB.png",
  "Delta RGB DDR4 16gb-kit (2x8gb) black": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK.png",
  "Delta RGB DDR4 16gb-kit (2x8gb) white": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) WHITE.png",
  "Delta RGB DDR4 32gb-kit (2x16gb) black": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) BLACK.png",
  "Delta RGB DDR4 32gb-kit (2x16gb) white": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) WHITE.png",
  "DDR4 DARKZA 16GB (2x8gb)": "/images/components/ram/TFORCE DDR4 DARKZA 16GB (2x8gb) 3600MHz.png",
  "Delta RGB DDR4 16gb kit (2x8gb) black": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK.png",
  "Delta RGB DDR4 16gb kit (2x8gb) white": "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) WHITE.png",
  "Delta RGB DDR4 32gb kit (2x16gb) black": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) BLACK.png",
  "Delta RGB DDR4 32gb kit (2x16gb) white": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) WHITE.png",
  "Delta RGB DDR4 (SINGLE STICK) 32gb white": "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) WHITE.png",
  
  // Motherboard Images - Exact database names
  "ASRock B550M STEEL LEGEND": "/images/components/motherboard/ASRock B550M STEEL LEGEND.png",
  "ASRock B550M-ITX-AC": "/images/components/motherboard/ASRock B550M-ITX-AC.png",
  "ASRock H510M-HVS": "/images/components/motherboard/ASRock H510M-HVS.png",
  "ASRock H610M-HVS": "/images/components/motherboard/ASRock H610M-HVS.png",
  "ASUS PRIME A520M K": "/images/components/motherboard/ASUS PRIME A520M K.png",
  "ASUS PRIME H510M-E": "/images/components/motherboard/ASUS PRIME H510M-E.png",
  "BIOSTAR A520MHP": "/images/components/motherboard/BIOSTAR A520MHP.png",
  "BIOSTAR B450MHP DDR43200 AM4": "/images/components/motherboard/BIOSTAR B450MHP DDR43200 AM4.png",
  "GIGABYTE AORUS B550M ELITE": "/images/components/motherboard/GIGABYTE AORUS B550M ELITE.png",
  "GIGABYTE B550M DS3H AC": "/images/components/motherboard/GIGABYTE B550M DS3H AC.png",
  "GIGABYTE B550M DS3H": "/images/components/motherboard/GIGABYTE B550M DS3H.png",
  "GIGABYTE B550M-K": "/images/components/motherboard/GIGABYTE B550M-K.png",
  "GIGABYTE B660M DS3H": "/images/components/motherboard/GIGABYTE B660M DS3H.png",
  "GIGABYTE H510M-K-V2": "/images/components/motherboard/GIGABYTE H510M-K-V2.png",
  "GIGABYTE H610M H": "/images/components/motherboard/GIGABYTE H610M H.png",
  "MMA A320": "/images/components/motherboard/MMA A320.png",
  "MSI B550M PRO-VDH": "/images/components/motherboard/MSI B550M PRO-VDH.png",
  "MSI MAG B550M": "/images/components/motherboard/MSI MAG B550M.png",
  "WHALEKOM B450MV1": "/images/components/motherboard/WHALEKOM B450MV1.png",
  "H510M HVS": "/images/components/motherboard/ASRock H510M-HVS.png",
  "B550M STEEL LEGEND": "/images/components/motherboard/ASRock B550M STEEL LEGEND.png",
  "A520M K": "/images/components/motherboard/ASUS PRIME A520M K.png",
  "B450MHP DDR4/3200 AM4": "/images/components/motherboard/BIOSTAR B450MHP DDR43200 AM4.png",
  "B450MV1": "/images/components/motherboard/WHALEKOM B450MV1.png",
  "A520MHP": "/images/components/motherboard/BIOSTAR A520MHP.png",
  
  // Storage Images - Exact database names
  "Crucial BX500 SSD": "/images/components/storage/Crucial BX500 SSD.png",
  "Crucial P3 1TB-2TB": "/images/components/storage/Crucial P3 1TB-2TB.png",
  "Kingston A400 SSD": "/images/components/storage/Kingston A400 SSD.png",
  "Kingston NV2 500GB-1TB": "/images/components/storage/Kingston NV2 500GB-1TB.png",
  "Samsung 970 EVO Plus 500GB": "/images/components/storage/Samsung 970 EVO Plus 500GB.png",
  "Samsung 980 1TB NVMe": "/images/components/storage/Samsung 980 1TB NVMe.png",
  "Seagate Barracuda 1TB-2TB HDD": "/images/components/storage/Seagate Barracuda 1TB-2TB HDD.png",
  "WD Blue 1TB-2TB HDD": "/images/components/storage/WD Blue 1TB-2TB HDD.png",
  "WD Blue SN570 1TB": "/images/components/storage/WD Blue SN570 1TB.png",
  "WD Blue SN580 500GB": "/images/components/storage/WD Blue SN580 500GB.png",
  "970 EVO PLUS 1tb": "/images/components/storage/Samsung 970 EVO Plus 500GB.png",
  "NV3 PCIe 4.0 1TB": "/images/components/storage/Kingston NV2 500GB-1TB.png",
  
  // PSU Images - Exact database names
  "Cooler Master MWE Bronze 550W": "/images/components/psu/Cooler Master MWE Bronze 550W.png",
  "Corsair CV550": "/images/components/psu/Corsair CV550.png",
  "Corsair CX550F": "/images/components/psu/Corsair CX550F.png",
  "DeepCool DN series": "/images/components/psu/DeepCool DN series.png",
  "EVGA 500 W1": "/images/components/psu/EVGA 500 W1.png",
  "EVGA 600 BR": "/images/components/psu/EVGA 600 BR.png",
  "FSP HV PRO 550W": "/images/components/psu/FSP HV PRO 550W.png",
  "Seasonic Core GM-500": "/images/components/psu/Seasonic Core GM-500.png",
  "Seasonic Focus GX-650": "/images/components/psu/Seasonic Focus GX-650.png",
  "Thermaltake Smart 500W": "/images/components/psu/Thermaltake Smart 500W.png",
  "CX550 80+ BRONZE 550watts": "/images/components/psu/Corsair CV550.png",
  "CX650 80+ BRONZE 650watts": "/images/components/psu/Corsair CX550F.png",
  "CV750 80+ BRONZE 750watts": "/images/components/psu/Corsair CV550.png",
  "RM750E 80+ GOLD FULLY MODULAR 750watts": "/images/components/psu/Seasonic Focus GX-650.png",
  "RM850E 80+ GOLD FULLY MODULAR 850watts": "/images/components/psu/Seasonic Focus GX-650.png",
  "DE-600 v2 600watts": "/images/components/psu/DeepCool DN series.png",
  "BTS-550 BRONZE 550WATTS": "/images/components/psu/EVGA 500 W1.png",
  "BTS-650 BRONZE 650WATTS": "/images/components/psu/EVGA 600 BR.png",
  "BTS-750 BRONZE 750WATTS": "/images/components/psu/EVGA 600 BR.png",
  "(GC-PS014W/RGPS-650SFX) 80+ GOLD FULL MOD (white) 650watts": "/images/components/psu/Seasonic Focus GX-650.png",
  "RGPS-700W 80+ BRONZE FULL MODULAR": "/images/components/psu/Seasonic Focus GX-650.png",
  "P550SS SILVER WHITE (ICE)": "/images/components/psu/EVGA 600 BR.png",
  "P550SS SILVER": "/images/components/psu/EVGA 600 BR.png",
  "GS550 ULTRA BLACK ATX POWERSUPPLY 550W 80+ BRONZE RGB": "/images/components/psu/Cooler Master MWE Bronze 550W.png",
  "GS650 ULTRA BLACK ATX POWERSUPPLY 650W 80+ BRONZE RGB": "/images/components/psu/Cooler Master MWE Bronze 550W.png",
  "CX750 80+ BRONZE 750watts": "/images/components/psu/Corsair CV550.png",
  
  // Case Images - Exact database names
  "ACER V920": "/images/components/case/ACER V920.png",
  "ACER V950": "/images/components/case/ACER V950.png",
  "COOLMAN HARLEY": "/images/components/case/COOLMAN HARLEY.png",
  "COOLMAN REYNA": "/images/components/case/COOLMAN REYNA.png",
  "COOLMAN RUBY": "/images/components/case/COOLMAN RUBY.png",
  "DARKFLASH DK351": "/images/components/case/DARKFLASH DK351.png",
  "DARKFLASH DLM21 MESH": "/images/components/case/DARKFLASH DLM21 MESH.png",
  "GAMDIAS TALOS E3 MESH": "/images/components/case/GAMDIAS TALOS E3 MESH.png",
  "INPLAY WIND 01": "/images/components/case/INPLAY WIND 01.png",
  "KEYTECH CYBORG CASE": "/images/components/case/KEYTECH CYBORG CASE.png",
  "KEYTECH ROBIN SE (BLACK-WHITE)": "/images/components/case/KEYTECH ROBIN SE (BLACK-WHITE).png",
  "KEYTECH T1000 (BLACK-WHITE)": "/images/components/case/KEYTECH T1000 (BLACK-WHITE).png",
  "MMA AK99": "/images/components/case/MMA AK99.png",
  "MMA SR89": "/images/components/case/MMA SR89.png",
  "NZXT H5 FLOW": "/images/components/case/NZXT H5 FLOW.png",
  "YGT B708": "/images/components/case/YGT B708.png",
  "YGT B709": "/images/components/case/YGT B709.png",
  "YGT N195": "/images/components/case/YGT N195.png",
  "VISOR - WHITE (TEMPERED GLASS)": "/images/components/case/KEYTECH ROBIN SE (BLACK-WHITE).png",
  
  // Cooler Images - Exact database names
  "DEEPCOOL AG400 (AIR COOLERS)": "/images/components/cooler/DEEPCOOL AG400 (AIR COOLERS).png",
  "DEEPCOOL AK400": "/images/components/cooler/DEEPCOOL AK400.png",
  "DEEPCOOL AK500": "/images/components/cooler/DEEPCOOL AK500.png",
  "DEEPCOOL LIQUID COOLER AIO - ARGB LE520": "/images/components/cooler/DEEPCOOL LIQUID COOLER AIO - ARGB LE520.png",
  "DEEPCOOL LIQUID COOLER AIO - LS520 SE DIGITAL)": "/images/components/cooler/DEEPCOOL LIQUID COOLER AIO - LS520 SE DIGITAL).png",
  "DEEPCOOL LIQUID COOLER AIO - LT520": "/images/components/cooler/DEEPCOOL LIQUID COOLER AIO - LT520.png",
  "DEEPCOOL MYSTIQUE 240": "/images/components/cooler/DEEPCOOL MYSTIQUE 240.png",
  "DEEPCOOL MYSTIQUE 360": "/images/components/cooler/DEEPCOOL MYSTIQUE 360.png",
  "JONSBO CR 1200 EVO (AIR COOLERS)": "/images/components/cooler/JONSBO CR 1200 EVO (AIR COOLERS).png",
  "JONSBO CR 1400 EVO (AIR COOLERS)": "/images/components/cooler/JONSBO CR 1400 EVO (AIR COOLERS).png",
  "JUNGLE LEOPARD ASTROBEAT": "/images/components/cooler/JUNGLE LEOPARD ASTROBEAT.png",
  "JUNGLE LEOPARD ASTROSHEL": "/images/components/cooler/JUNGLE LEOPARD ASTROSHEL.png",
  "OVATION HURRICANE 240": "/images/components/cooler/OVATION HURRICANE 240.png",
  "THERMALRIGHT LIQUID COOLER FROZEN WARFRAME 240 ARGB": "/images/components/cooler/THERMALRIGHT LIQUID COOLER FROZEN WARFRAME 240 ARGB.png",
  "YGT LIQUID COOLER AIO - DF-120": "/images/components/cooler/YGT LIQUID COOLER AIO - DF-120.png",
};

// Fallback images by category - using local images
const fallbackImages = {
  cpu: [
    "/images/components/cpu/R3 3200G (TRAY) WITH HEATSINK FAN.png",
    "/images/components/cpu/r5_5600G_tray.png",
    "/images/components/cpu/R5 5600X (TRAY) WITH HEATSINK FAN.png",
    "/images/components/cpu/R7 5700X (TRAY) WITH HEATSINK FAN.png",
    "/images/components/cpu/R7 5800X (TRAY) WITH HEATSINK FAN.png",
  ],
  gpu: [
    "/images/components/gpu/GALAX RTX 3060 1-CLICK OC BLK 12GB.png",
    "/images/components/gpu/GIGABYTE RTX 4060 AERO OC 8GB WHITE.png",
    "/images/components/gpu/GIGABYTE RX 6600 8GB EAGLE.png",
    "/images/components/gpu/SAPPHIRE PULSE AMD RADEON RX 7800 XT 16GB.png",
  ],
  ram: [
    "/images/components/ram/KINGSTON FURY BEAST DDR4 8GB.png",
    "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK.png",
    "/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) WHITE.png",
    "/images/components/ram/TFORCE Delta RGB DDR4 32GB kit (2x16gb) BLACK.png",
  ],
  motherboard: [
    "/images/components/motherboard/ASRock B550M STEEL LEGEND.png",
    "/images/components/motherboard/GIGABYTE B550M DS3H.png",
    "/images/components/motherboard/MSI B550M PRO-VDH.png",
    "/images/components/motherboard/GIGABYTE B660M DS3H.png",
  ],
  storage: [
    "/images/components/storage/Samsung 970 EVO Plus 500GB.png",
    "/images/components/storage/WD Blue SN570 1TB.png",
    "/images/components/storage/Crucial P3 1TB-2TB.png",
    "/images/components/storage/Kingston NV2 500GB-1TB.png",
  ],
  psu: [
    "/images/components/psu/Corsair CX550F.png",
    "/images/components/psu/EVGA 600 BR.png",
    "/images/components/psu/Seasonic Focus GX-650.png",
    "/images/components/psu/Thermaltake Smart 500W.png",
  ],
  case: [
    "/images/components/case/INPLAY WIND 01.png",
    "/images/components/case/NZXT H5 FLOW.png",
    "/images/components/case/COOLMAN HARLEY.png",
    "/images/components/case/DARKFLASH DK351.png",
  ],
  cooler: [
    "/images/components/cooler/DEEPCOOL AK400.png",
    "/images/components/cooler/DEEPCOOL AK500.png",
    "/images/components/cooler/DEEPCOOL LIQUID COOLER AIO - ARGB LE520.png",
    "/images/components/cooler/DEEPCOOL MYSTIQUE 240.png",
  ],
  default: [
    "/images/components/cpu/R3 3200G (TRAY) WITH HEATSINK FAN.png",
    "/images/components/gpu/GALAX RTX 3060 1-CLICK OC BLK 12GB.png",
  ]
};

// Function to determine component type from name
function getComponentTypeFromName(name) {
  const lowerName = name.toLowerCase();
  
  // CPU detection
  if (lowerName.includes('ryzen') || lowerName.includes('core i') || lowerName.includes('intel') || lowerName.includes('amd') || lowerName.includes('cpu') || lowerName.includes('r3') || lowerName.includes('r5') || lowerName.includes('r7') || lowerName.includes('r9') || lowerName.includes('athlon') || lowerName.includes('i3') || lowerName.includes('i5') || lowerName.includes('i7')) {
    return 'cpu';
  }
  
  // GPU detection
  if (lowerName.includes('rtx') || lowerName.includes('gtx') || lowerName.includes('rx') || lowerName.includes('graphics') || lowerName.includes('gpu') || lowerName.includes('radeon') || lowerName.includes('geforce')) {
    return 'gpu';
  }
  
  // RAM detection
  if (lowerName.includes('ddr') || lowerName.includes('memory') || lowerName.includes('ram') || lowerName.includes('fury') || lowerName.includes('vengeance') || lowerName.includes('trident') || lowerName.includes('tforce') || lowerName.includes('kingston') || lowerName.includes('team') || lowerName.includes('skihotar') || lowerName.includes('neo forza') || lowerName.includes('kingspec')) {
    return 'ram';
  }
  
  // Motherboard detection
  if (lowerName.includes('motherboard') || lowerName.includes('mobo') || lowerName.includes('b550') || lowerName.includes('b660') || lowerName.includes('h510') || lowerName.includes('x570') || lowerName.includes('asrock') || lowerName.includes('asus') || lowerName.includes('msi') || lowerName.includes('gigabyte') || lowerName.includes('biostar') || lowerName.includes('mma') || lowerName.includes('whalekom')) {
    return 'motherboard';
  }
  
  // Storage detection
  if (lowerName.includes('ssd') || lowerName.includes('hdd') || lowerName.includes('nvme') || lowerName.includes('samsung') || lowerName.includes('wd') || lowerName.includes('seagate') || lowerName.includes('crucial') || lowerName.includes('kingston')) {
    return 'storage';
  }
  
  // PSU detection
  if (lowerName.includes('psu') || lowerName.includes('power') || lowerName.includes('watt') || lowerName.includes('corsair') || lowerName.includes('evga') || lowerName.includes('seasonic') || lowerName.includes('cooler master') || lowerName.includes('deepcool') || lowerName.includes('fsp') || lowerName.includes('thermaltake')) {
    return 'psu';
  }
  
  // Case detection
  if (lowerName.includes('case') || lowerName.includes('chassis') || lowerName.includes('nzxt') || lowerName.includes('coolman') || lowerName.includes('darkflash') || lowerName.includes('gamdias') || lowerName.includes('inplay') || lowerName.includes('keytech') || lowerName.includes('acer') || lowerName.includes('mma') || lowerName.includes('ygt')) {
    return 'case';
  }
  
  // Cooler detection
  if (lowerName.includes('cooler') || lowerName.includes('fan') || lowerName.includes('deepcool') || lowerName.includes('jonsbo') || lowerName.includes('jungle leopard') || lowerName.includes('ovation') || lowerName.includes('thermalright') || lowerName.includes('ygt') || lowerName.includes('aio') || lowerName.includes('liquid')) {
    return 'cooler';
  }
  
  return 'default';
}

// Enhanced function to get component image with better matching
export function getComponentImage(component, componentType = null) {
  // If component is an object, extract the name
  const componentName = typeof component === 'string' ? component : component.name;
  
  if (!componentName) {
    return resolveAssetPath(fallbackImages.default[0]);
  }
  
  // First, try to get the exact image for the component name
  if (componentImages[componentName]) {
    return resolveAssetPath(componentImages[componentName]);
  }
  
  // Try partial matching for common patterns
  const lowerName = componentName.toLowerCase();

  // Early CPU pattern for common shorthand without the word 'ryzen'
  if (lowerName.includes('5600g')) {
    return resolveAssetPath("/images/components/cpu/r5_5600G_tray.png");
  }
  
  // CPU matching
  if (lowerName.includes('ryzen')) {
    if (lowerName.includes('5600x')) return resolveAssetPath("/images/components/cpu/R5 5600X (TRAY) WITH HEATSINK FAN.png");
    if (lowerName.includes('5600g')) return resolveAssetPath("/images/components/cpu/r5_5600G_tray.png");
    if (lowerName.includes('5700x')) return resolveAssetPath("/images/components/cpu/R7 5700X (TRAY) WITH HEATSINK FAN.png");
    if (lowerName.includes('5800x')) return resolveAssetPath("/images/components/cpu/R7 5800X (TRAY) WITH HEATSINK FAN.png");
    if (lowerName.includes('7600x')) return resolveAssetPath("/images/components/cpu/R5 7600X (TRAY) WITH HEATSINK FAN.png");
    return resolveAssetPath(fallbackImages.cpu[0]);
  }
  
  // GPU matching
  if (lowerName.includes('rtx')) {
    if (lowerName.includes('3060')) return resolveAssetPath("/images/components/gpu/GALAX RTX 3060 1-CLICK OC BLK 12GB.png");
    if (lowerName.includes('4060')) return resolveAssetPath("/images/components/gpu/GIGABYTE RTX 4060 AERO OC 8GB WHITE.png");
    if (lowerName.includes('4070')) return resolveAssetPath("/images/components/gpu/GIGABYTE RTX 4070 SUPER EAGLE OC 12GB.png");
    return resolveAssetPath(fallbackImages.gpu[0]);
  }
  
  if (lowerName.includes('rx')) {
    if (lowerName.includes('6600')) return resolveAssetPath("/images/components/gpu/GIGABYTE RX 6600 8GB EAGLE.png");
    if (lowerName.includes('7800')) return resolveAssetPath("/images/components/gpu/SAPPHIRE PULSE AMD RADEON RX 7800 XT 16GB.png");
    return resolveAssetPath(fallbackImages.gpu[0]);
  }
  
  // RAM matching
  if (lowerName.includes('kingston') && lowerName.includes('fury')) {
    return resolveAssetPath("/images/components/ram/KINGSTON FURY BEAST DDR4 8GB.png");
  }
  if (lowerName.includes('tforce') || lowerName.includes('t-force')) {
    return resolveAssetPath("/images/components/ram/TFORCE Delta RGB DDR4 16GB kit (2x8gb) BLACK.png");
  }
  if (lowerName.includes('team')) {
    return resolveAssetPath("/images/components/ram/TEAM ELITE PLUS GOLD DDR4 8GB.png");
  }
  
  // Motherboard matching
  if (lowerName.includes('asrock')) {
    return resolveAssetPath("/images/components/motherboard/ASRock B550M STEEL LEGEND.png");
  }
  if (lowerName.includes('msi')) {
    return resolveAssetPath("/images/components/motherboard/MSI B550M PRO-VDH.png");
  }
  if (lowerName.includes('asus')) {
    return resolveAssetPath("/images/components/motherboard/ASUS PRIME A520M K.png");
  }
  if (lowerName.includes('gigabyte')) {
    return resolveAssetPath("/images/components/motherboard/GIGABYTE B550M DS3H.png");
  }
  
  // Storage matching
  if (lowerName.includes('samsung')) {
    return resolveAssetPath("/images/components/storage/Samsung 970 EVO Plus 500GB.png");
  }
  if (lowerName.includes('wd') || lowerName.includes('western digital')) {
    return resolveAssetPath("/images/components/storage/WD Blue SN570 1TB.png");
  }
  if (lowerName.includes('crucial')) {
    return resolveAssetPath("/images/components/storage/Crucial P3 1TB-2TB.png");
  }
  if (lowerName.includes('seagate')) {
    return resolveAssetPath("/images/components/storage/Seagate Barracuda 1TB-2TB HDD.png");
  }
  
  // PSU matching
  if (lowerName.includes('corsair')) {
    return resolveAssetPath("/images/components/psu/Corsair CX550F.png");
  }
  if (lowerName.includes('evga')) {
    return resolveAssetPath("/images/components/psu/EVGA 600 BR.png");
  }
  if (lowerName.includes('seasonic')) {
    return resolveAssetPath("/images/components/psu/Seasonic Focus GX-650.png");
  }
  if (lowerName.includes('thermaltake')) {
    return resolveAssetPath("/images/components/psu/Thermaltake Smart 500W.png");
  }
  
  // Case matching
  if (lowerName.includes('nzxt')) {
    return resolveAssetPath("/images/components/case/NZXT H5 FLOW.png");
  }
  if (lowerName.includes('coolman')) {
    return resolveAssetPath("/images/components/case/COOLMAN HARLEY.png");
  }
  if (lowerName.includes('darkflash')) {
    return resolveAssetPath("/images/components/case/DARKFLASH DK351.png");
  }
  if (lowerName.includes('inplay')) {
    return resolveAssetPath("/images/components/case/INPLAY WIND 01.png");
  }
  
  // Cooler matching
  if (lowerName.includes('deepcool')) {
    return resolveAssetPath("/images/components/cooler/DEEPCOOL AK400.png");
  }
  if (lowerName.includes('jonsbo')) {
    return resolveAssetPath("/images/components/cooler/JONSBO CR 1200 EVO (AIR COOLERS).png");
  }
  if (lowerName.includes('thermalright')) {
    return resolveAssetPath("/images/components/cooler/THERMALRIGHT LIQUID COOLER FROZEN WARFRAME 240 ARGB.png");
  }
  
  // If no exact match, determine type from name and use fallback
  const type = componentType || getComponentTypeFromName(componentName);
  const images = fallbackImages[type] || fallbackImages.default;
  
  // Return a deterministic fallback image (prevents flicker)
  const idx = stableIndexFromString(componentName, images.length);
  return resolveAssetPath(images[idx]);
}