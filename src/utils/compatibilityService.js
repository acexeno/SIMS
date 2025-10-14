// Comprehensive Compatibility Service for PC Building System

// Compatibility rules and specifications
const COMPATIBILITY_RULES = {
  // CPU Socket Compatibility
  cpu_sockets: {
    // AMD Sockets
    'AMD AM4': ['AMD AM4'],
    'AMD AM5': ['AMD AM5'],
    'AMD sTRX4': ['AMD sTRX4'],
    'AMD TR4': ['AMD TR4'],
    'AMD sWRX8': ['AMD sWRX8'],
    // Intel Sockets
    'Intel LGA1200': ['Intel LGA1200'],
    'Intel LGA1700': ['Intel LGA1700'],
    'Intel LGA1851': ['Intel LGA1851'],
    'Intel LGA1151': ['Intel LGA1151'],
    'Intel LGA2066': ['Intel LGA2066'],
    'Intel LGA2011-3': ['Intel LGA2011-3'],
    'Intel LGA3647': ['Intel LGA3647'],
    'Intel LGA4189': ['Intel LGA4189']
  },

  // RAM Type Compatibility
  ram_types: {
    'DDR4': ['DDR4'],
    'DDR5': ['DDR5'],
    'DDR3': ['DDR3']
  },

  // RAM Speed Compatibility (MHz)
  ram_speeds: {
    'DDR4': {
      'min': 2133,
      'max': 4800,
      'recommended': [2400, 2666, 3000, 3200, 3600, 4000]
    },
    'DDR5': {
      'min': 4800,
      'max': 6400, // More realistic max for most motherboards
      'recommended': [4800, 5200, 5600, 6000, 6400]
    }
  },

  // CPU-RAM Compatibility
  cpu_ram_compatibility: {
    'Intel LGA1200': ['DDR4'],
    'Intel LGA1700': ['DDR4', 'DDR5'],
    'Intel LGA1851': ['DDR5'], // 14th gen Intel primarily uses DDR5
    'Intel LGA1151': ['DDR4'],
    'AMD AM4': ['DDR4'],
    'AMD AM5': ['DDR5']
  },

  // Form Factor Compatibility
  form_factors: {
    'ATX': ['ATX', 'Micro-ATX', 'Mini-ITX'],
    'Micro-ATX': ['Micro-ATX', 'Mini-ITX'], // Micro-ATX cases can't fit ATX motherboards
    'Mini-ITX': ['Mini-ITX'], // Mini-ITX cases can only fit Mini-ITX motherboards
    'E-ATX': ['E-ATX', 'ATX', 'Micro-ATX', 'Mini-ITX']
  },

  // Power Requirements (in watts)
  power_requirements: {
    'cpu': {
      'low': 65,    // Low-end CPUs
      'mid': 95,    // Mid-range CPUs
      'high': 125,  // High-end CPUs
      'extreme': 165 // Extreme CPUs
    },
    'gpu': {
      'low': 75,    // Integrated/Entry GPUs
      'mid': 150,   // Mid-range GPUs
      'high': 250,  // High-end GPUs
      'extreme': 350 // Extreme GPUs
    }
  },

  // Case GPU Length Support (in mm)
  gpu_length_support: {
    'small': 300,
    'medium': 350,
    'large': 400,
    'extreme': 450
  },

  // Case Cooler Height Support (in mm)
  cooler_height_support: {
    'small': 160,
    'medium': 180,
    'large': 200,
    'extreme': 220
  }
};

// Helper function to extract component specifications
export const extractComponentSpecs = (component, specType) => {
  if (!component) return null;

  const specs = component.specs || {};
  
  switch (specType) {
    case 'socket':
      return component.socket || specs.socket || extractSocketFromName(component.name);
    
    case 'brand':
      return component.brand || specs.brand || extractBrandFromName(component.name);
    
    case 'ram_type':
      return component.ram_type || specs.ram_type || component.type || specs.type;
    
    case 'form_factor':
      return component.form_factor || specs.form_factor;
    
    case 'wattage':
      return component.wattage || specs.wattage || extractWattageFromName(component.name);
    
    case 'tdp':
      return component.tdp || specs.tdp || extractTDPFromName(component.name);
    
    case 'length':
      return component.length || specs.length || component.dimensions?.length;
    
    case 'height':
      return component.height || specs.height || component.dimensions?.height;
    
    case 'capacity':
      return component.capacity || specs.capacity;
    
    case 'speed':
      return component.speed || specs.speed;
    
    default:
      return component[specType] || specs[specType];
  }
};

// Helper function to extract socket from component name
const extractSocketFromName = (name) => {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  const nameClean = lowerName.replace(/[\s\-_]/g, '');
  
  // AMD/Intel socket detection (tolerant)
  if (nameClean.includes('am4') || nameClean.includes('amd4')) return 'AMD AM4';
  if (nameClean.includes('am5') || nameClean.includes('amd5')) return 'AMD AM5';
  if (nameClean.includes('lga1200')) return 'Intel LGA1200';
  if (nameClean.includes('lga1700')) return 'Intel LGA1700';
  if (nameClean.includes('lga1151')) return 'Intel LGA1151';
  if (nameClean.includes('lga2066')) return 'Intel LGA2066';
  
  // AMD Ryzen shorthand detection (e.g., "R5 5600X", "R7 5700G", "R7 5700X3D", "R5-7600X")
  // Heuristic: Ryzen 1000-5000 series -> AM4, 7000+ series -> AM5
  // We also treat 6000 desktop APUs (rare in this dataset) as AM4 by default.
  const amdShort = lowerName.match(/\br[3579]\s*-?\s*(\d{4})([a-z0-9]*)?/i);
  if (amdShort && amdShort[1]) {
    const series = parseInt(amdShort[1], 10);
    if (!isNaN(series)) {
      if (series >= 7000) return 'AMD AM5';
      // Default AM4 for 1000-6999 (covers 3200G, 5600X, 5700G, 5800X, 5900X, 5700X3D, etc.)
      if (series >= 1000) return 'AMD AM4';
    }
  }
  
  // Intel CPU model number to socket mapping - More comprehensive
  // Intel 10th/11th gen (LGA1200)
  if (lowerName.includes('i7-11700') || lowerName.includes('i7-11700k') || lowerName.includes('i7-11700f')) {
    return 'Intel LGA1200';
  }
  if (lowerName.includes('i5-11600') || lowerName.includes('i5-11500') || lowerName.includes('i5-11400')) {
    return 'Intel LGA1200';
  }
  if (lowerName.includes('i3-11100') || lowerName.includes('i3-10100')) {
    return 'Intel LGA1200';
  }
  if (lowerName.includes('i9-11900') || lowerName.includes('i9-10900')) {
    return 'Intel LGA1200';
  }
  if (lowerName.includes('i5-10400') || lowerName.includes('i5-10600')) {
    return 'Intel LGA1200';
  }
  if (lowerName.includes('i3-10100') || lowerName.includes('i3-10300')) {
    return 'Intel LGA1200';
  }
  
  // Intel 12th/13th gen (LGA1700)
  if (lowerName.includes('i7-12700') || lowerName.includes('i7-13700')) {
    return 'Intel LGA1700';
  }
  if (lowerName.includes('i5-12600') || lowerName.includes('i5-13600')) {
    return 'Intel LGA1700';
  }
  if (lowerName.includes('i3-12100') || lowerName.includes('i3-13100')) {
    return 'Intel LGA1700';
  }
  if (lowerName.includes('i9-12900') || lowerName.includes('i9-13900')) {
    return 'Intel LGA1700';
  }
  
  // Intel 14th gen (LGA1851)
  if (lowerName.includes('i7-14700') || lowerName.includes('i5-14600') || lowerName.includes('i3-14100') || lowerName.includes('i9-14900')) {
    return 'Intel LGA1851';
  }
  
  // Intel 8th/9th gen (LGA1151)
  if (lowerName.includes('i7-8700') || lowerName.includes('i7-9700')) {
    return 'Intel LGA1151';
  }
  if (lowerName.includes('i5-8400') || lowerName.includes('i5-9400')) {
    return 'Intel LGA1151';
  }
  if (lowerName.includes('i3-8100') || lowerName.includes('i3-9100')) {
    return 'Intel LGA1151';
  }
  
  // AMD Ryzen socket detection - More comprehensive
  if (lowerName.includes('ryzen 3 3200g') || lowerName.includes('ryzen 5 5600g') || lowerName.includes('ryzen 5 5600gt')) {
    return 'AMD AM4';
  }
  if (lowerName.includes('ryzen 7 5800') || lowerName.includes('ryzen 9 5900')) {
    return 'AMD AM4';
  }
  if (lowerName.includes('ryzen 7 7700') || lowerName.includes('ryzen 9 7900')) {
    return 'AMD AM5';
  }
  
  // AMD Ryzen 7000 series (AM5)
  if (lowerName.includes('ryzen 5 7600') || lowerName.includes('ryzen 7 7800') || lowerName.includes('ryzen 9 7950')) {
    return 'AMD AM5';
  }
  
  // AMD Ryzen 5000 series (AM4)
  if (lowerName.includes('ryzen 5 5600') || lowerName.includes('ryzen 7 5700') || lowerName.includes('ryzen 9 5950')) {
    return 'AMD AM4';
  }
  
  // AMD Athlon series (AM4)
  if (lowerName.includes('athlon 200ge') || lowerName.includes('athlon 300ge') || lowerName.includes('athlon 3000g')) {
    return 'AMD AM4';
  }
  
  // AMD A-series (AM4)
  if (lowerName.includes('a8 7680')) {
    return 'AMD AM4';
  }
  
  return null;
};

// Helper function to extract brand from component name
const extractBrandFromName = (name) => {
  if (!name) return null;
  const lowerName = name.toLowerCase();
  
  if (lowerName.includes('amd') || lowerName.includes('ryzen')) return 'AMD';
  if (lowerName.includes('intel') || lowerName.includes('core')) return 'Intel';
  if (lowerName.includes('nvidia') || lowerName.includes('rtx') || lowerName.includes('gtx')) return 'NVIDIA';
  if (lowerName.includes('radeon') || lowerName.includes('rx')) return 'AMD';
  
  return null;
};

// Helper function to extract wattage from component name
const extractWattageFromName = (name) => {
  if (!name) return null;
  const wattageMatch = name.match(/(\d+)\s*w/i);
  return wattageMatch ? parseInt(wattageMatch[1]) : null;
};

// Helper function to extract TDP from component name
const extractTDPFromName = (name) => {
  if (!name) return null;
  const tdpMatch = name.match(/(\d+)\s*w\s*tdp/i);
  return tdpMatch ? parseInt(tdpMatch[1]) : null;
};

// Normalization helpers
const normalizeSocket = (socket) => {
  if (!socket) return null;
  let s = socket.toString().trim().toUpperCase();
  // Remove common vendor prefixes and punctuation
  s = s.replace(/^SOCKET\s+/, '');
  s = s.replace(/[\s\-_]/g, '');
  // Tolerate AMDx typo (AMD4 -> AM4, AMD5 -> AM5)
  s = s.replace(/^AMD4$/, 'AM4').replace(/^AMD5$/, 'AM5').replace(/^AMD/, 'AM');
  // Map to canonical tokens
  if (s.includes('AM4')) return 'AMD AM4';
  if (s.includes('AM5')) return 'AMD AM5';
  if (s.includes('LGA1200')) return 'Intel LGA1200';
  if (s.includes('LGA1700')) return 'Intel LGA1700';
  if (s.includes('LGA1851')) return 'Intel LGA1851';
  if (s.includes('LGA1151')) return 'Intel LGA1151';
  if (s.includes('LGA2066')) return 'Intel LGA2066';
  if (s.includes('LGA2011')) return 'Intel LGA2011-3';
  if (s.includes('LGA3647')) return 'Intel LGA3647';
  if (s.includes('LGA4189')) return 'Intel LGA4189';
  return s;
};

const normalizeFormFactor = (ff) => {
  if (!ff) return null;
  let v = ff.toString().trim().toLowerCase();
  v = v.replace(/_/g, '-');
  v = v.replace(/\s+/g, '-');
  // Common aliases
  if (v === 'atx') return 'ATX';
  if (v === 'e-atx' || v === 'eatx') return 'E-ATX';
  if (v === 'micro-atx' || v === 'matx' || v === 'u-atx' || v === 'uatx' || v === 'm-atx' || v === 'microatx') return 'Micro-ATX';
  if (v === 'mini-itx' || v === 'mitx' || v === 'miniitx') return 'Mini-ITX';
  // Title-case common forms
  if (v.includes('micro') && v.includes('atx')) return 'Micro-ATX';
  if (v.includes('mini') && v.includes('itx')) return 'Mini-ITX';
  if (v.includes('atx')) return 'ATX';
  return ff; // fallback to original
};

// Main compatibility checking function
export const checkCompatibility = (component1, component2, compatibilityType) => {
  switch (compatibilityType) {
    case 'cpu_motherboard':
      return checkCPUMotherboardCompatibility(component1, component2);
    
    case 'ram_motherboard':
      return checkRAMMotherboardCompatibility(component1, component2);
    
    case 'case_motherboard':
      return checkCaseMotherboardCompatibility(component1, component2);
    
    case 'psu_power':
      return checkPSUPowerCompatibility(component1, component2);
    
    case 'gpu_case':
      return checkGPUCaseCompatibility(component1, component2);
    
    case 'cooler_case':
      return checkCoolerCaseCompatibility(component1, component2);
    
    default:
      return { compatible: true, reason: 'No specific compatibility check defined' };
  }
};

// CPU-Motherboard compatibility check
const checkCPUMotherboardCompatibility = (cpu, motherboard) => {
  const cpuSocket = extractComponentSpecs(cpu, 'socket');
  const moboSocket = extractComponentSpecs(motherboard, 'socket');
  
  // If we have socket information for both, compare normalized values
  if (cpuSocket && moboSocket) {
    const nsCpu = normalizeSocket(cpuSocket);
    const nsMobo = normalizeSocket(moboSocket);
    if (nsCpu && nsMobo) {
      const compatible = nsCpu === nsMobo;
      return {
        compatible,
        reason: compatible ? 'Socket compatible' : `Socket mismatch: ${nsCpu} vs ${nsMobo}`,
        details: { cpuSocket: nsCpu, moboSocket: nsMobo }
      };
    }
    // Fallback to loose string compare if normalization failed
    const compatible = cpuSocket.toString().trim().toLowerCase() === moboSocket.toString().trim().toLowerCase();
    return {
      compatible,
      reason: compatible ? 'Socket compatible' : `Socket mismatch: ${cpuSocket} vs ${moboSocket}`,
      details: { cpuSocket, moboSocket }
    };
  }
  
  // Fallback: If socket info is missing, check brand compatibility
  const cpuBrand = extractComponentSpecs(cpu, 'brand');
  const moboBrand = extractComponentSpecs(motherboard, 'brand');
  
  if (cpuBrand && moboBrand) {
    // AMD CPUs generally work with AMD motherboards, Intel with Intel
    const brandCompatible = (cpuBrand === 'AMD' && moboBrand === 'AMD') || 
                           (cpuBrand === 'Intel' && moboBrand === 'Intel');
    
    return {
      compatible: brandCompatible,
      reason: brandCompatible ? 
        `Brand compatible: ${cpuBrand} CPU with ${moboBrand} motherboard` : 
        `Brand mismatch: ${cpuBrand} CPU with ${moboBrand} motherboard`,
      details: { cpuBrand, moboBrand, cpuSocket, moboSocket }
    };
  }
  
  // Final fallback: If we can't determine compatibility, assume compatible
  // This prevents blocking users when data is incomplete
  return {
    compatible: true,
    reason: 'Compatibility cannot be determined - assuming compatible',
    details: { cpuSocket, moboSocket, cpuBrand, moboBrand }
  };
};

// RAM-Motherboard compatibility check
const checkRAMMotherboardCompatibility = (ram, motherboard) => {
  const ramType = extractComponentSpecs(ram, 'ram_type');
  const moboRamType = extractComponentSpecs(motherboard, 'ram_type');
  const ramSpeed = extractComponentSpecs(ram, 'speed');
  const moboMaxSpeed = extractComponentSpecs(motherboard, 'max_ram_speed');
  const ramCapacity = extractComponentSpecs(ram, 'capacity');
  const moboMaxCapacity = extractComponentSpecs(motherboard, 'max_ram_capacity');
  const ramSticks = extractComponentSpecs(ram, 'modules') || 1;
  const moboRamSlots = extractComponentSpecs(motherboard, 'ram_slots');
  
  const issues = [];
  const details = { ramType, moboRamType, ramSpeed, moboMaxSpeed, ramCapacity, moboMaxCapacity, ramSticks, moboRamSlots };
  
  // Check RAM type compatibility
  if (ramType && moboRamType && ramType !== moboRamType) {
    issues.push(`RAM type mismatch: ${ramType} vs ${moboRamType}`);
  }
  
  // Enhanced RAM speed compatibility check
  if (ramSpeed && moboMaxSpeed) {
    const ramSpeedNum = parseInt(ramSpeed);
    const moboMaxSpeedNum = parseInt(moboMaxSpeed);
    
    if (ramSpeedNum > moboMaxSpeedNum) {
      issues.push(`RAM speed (${ramSpeed}MHz) exceeds motherboard maximum (${moboMaxSpeed}MHz)`);
    } else if (ramSpeedNum < 2133) {
      issues.push(`RAM speed (${ramSpeed}MHz) is below minimum supported (2133MHz)`);
    }
  }
  
  // Check RAM capacity per module
  if (ramCapacity && moboMaxCapacity) {
    const maxPerModule = Math.floor(parseInt(moboMaxCapacity) / (moboRamSlots || 4));
    if (parseInt(ramCapacity) > maxPerModule) {
      issues.push(`RAM module size (${ramCapacity}GB) exceeds maximum supported (${maxPerModule}GB per module)`);
    }
  }
  
  // Check number of RAM sticks vs slots
  if (ramSticks && moboRamSlots && ramSticks > moboRamSlots) {
    issues.push(`Number of RAM modules (${ramSticks}) exceeds motherboard slots (${moboRamSlots})`);
  }
  
  // Check total RAM capacity
  if (ramCapacity && ramSticks && moboMaxCapacity) {
    const totalRam = parseInt(ramCapacity) * ramSticks;
    if (totalRam > parseInt(moboMaxCapacity)) {
      issues.push(`Total RAM (${totalRam}GB) exceeds motherboard maximum (${moboMaxCapacity}GB)`);
    }
  }
  
  // Check for dual-channel optimization
  if (ramSticks === 1 && moboRamSlots >= 2) {
    issues.push('Warning: Single RAM stick detected - consider dual-channel setup for better performance');
  }
  
  // Check for odd number of RAM sticks (not recommended)
  if (ramSticks > 1 && ramSticks % 2 !== 0) {
    issues.push('Warning: Odd number of RAM sticks may not enable dual-channel mode');
  }
  
  // Return results
  if (issues.length > 0) {
    const criticalIssues = issues.filter(issue => !issue.startsWith('Warning:'));
    return {
      compatible: criticalIssues.length === 0,
      reason: issues.join('; '),
      details,
      warnings: issues.filter(issue => issue.startsWith('Warning:')).length
    };
  }
  
  // If we get here, all checks passed
  return {
    compatible: true,
    reason: 'RAM is compatible with motherboard',
    details
  };
};

// Case-Motherboard compatibility check
const checkCaseMotherboardCompatibility = (case_, motherboard) => {
  const caseFormFactor = extractComponentSpecs(case_, 'form_factor');
  const moboFormFactor = extractComponentSpecs(motherboard, 'form_factor');
  
  // If we have form factor information for both, check with normalization
  if (caseFormFactor && moboFormFactor) {
    const cf = normalizeFormFactor(caseFormFactor);
    const mf = normalizeFormFactor(moboFormFactor);
    if (cf && mf && COMPATIBILITY_RULES.form_factors[cf]) {
      // Check if motherboard form factor is supported by case
      const compatible = COMPATIBILITY_RULES.form_factors[cf].includes(mf);
      return {
        compatible,
        reason: compatible ? 'Form factor compatible' : `Form factor mismatch: ${mf} motherboard cannot fit in ${cf} case`,
        details: { caseFormFactor: cf, moboFormFactor: mf }
      };
    }
    // Unknown or unrecognized form factors: assume compatible to avoid hiding options
    return {
      compatible: true,
      reason: 'Form factor unknown or unrecognized - assuming compatible',
      details: { caseFormFactor: cf || caseFormFactor, moboFormFactor: mf || moboFormFactor }
    };
  }
  
  // Fallback: If form factor info is missing, check brand compatibility
  const caseBrand = extractComponentSpecs(case_, 'brand');
  const moboBrand = extractComponentSpecs(motherboard, 'brand');
  
  if (caseBrand && moboBrand) {
    // Most case brands work with most motherboards
    const brandCompatible = true; // Cases are generally compatible across brands
    
    return {
      compatible: brandCompatible,
      reason: brandCompatible ? 
        `Case brand compatible: ${caseBrand} case with ${moboBrand} motherboard` : 
        `Case brand mismatch: ${caseBrand} case with ${moboBrand} motherboard`,
      details: { caseBrand, moboBrand, caseFormFactor, moboFormFactor }
    };
  }
  
  // Final fallback: If we can't determine compatibility, assume compatible
  // This prevents blocking users when data is incomplete
  return {
    compatible: true,
    reason: 'Case compatibility cannot be determined - assuming compatible',
    details: { caseFormFactor, moboFormFactor, caseBrand, moboBrand }
  };
};

// PSU Power compatibility check
const checkPSUPowerCompatibility = (psu, components) => {
  const psuWattage = extractComponentSpecs(psu, 'wattage');
  const psuEfficiency = extractComponentSpecs(psu, 'efficiency') || '80+ Gold'; // Default to 80+ Gold if not specified
  
  if (!psuWattage) {
    return { compatible: true, reason: 'PSU wattage unknown - assuming compatible (verify PSU specs)' };
  }
  
  // Calculate power requirements for each component
  const powerBreakdown = {};
  let totalPowerNeeded = 0;
  
  // CPU Power (TDP + overclocking headroom)
  if (components.cpu) {
    const baseTDP = extractComponentSpecs(components.cpu, 'tdp') || 95;
    const isOverclockable = extractComponentSpecs(components.cpu, 'unlocked_multiplier') === true;
    const cpuPower = Math.ceil(baseTDP * (isOverclockable ? 1.4 : 1.2)); // 40% buffer for OC, 20% for non-OC
    powerBreakdown.cpu = cpuPower;
    totalPowerNeeded += cpuPower;
  }
  
  // GPU Power (TDP + transient spike buffer)
  if (components.gpu) {
    const baseTDP = extractComponentSpecs(components.gpu, 'tdp') || 150;
    const isHighEnd = baseTDP > 200; // High-end GPUs have bigger power spikes
    const gpuPower = Math.ceil(baseTDP * (isHighEnd ? 1.5 : 1.3)); // 50% buffer for high-end, 30% for others
    powerBreakdown.gpu = gpuPower;
    totalPowerNeeded += gpuPower;
  }
  
  // Motherboard Power (varies by chipset and features)
  if (components.motherboard) {
    const chipset = extractComponentSpecs(components.motherboard, 'chipset') || '';
    const isHighEnd = ['X570', 'Z690', 'X670', 'Z790'].some(c => chipset.includes(c));
    const moboPower = isHighEnd ? 80 : 50; // More power for high-end chipsets
    powerBreakdown.motherboard = moboPower;
    totalPowerNeeded += moboPower;
  }
  
  // RAM Power (depends on number of sticks and speed)
  if (components.ram) {
    const ramSticks = extractComponentSpecs(components.ram, 'modules') || 1;
    const ramSpeed = extractComponentSpecs(components.ram, 'speed') || 3200;
    const ramVoltage = extractComponentSpecs(components.ram, 'voltage') || 1.35;
    // Rough estimate: 1.5W per GB + 0.1W per 100MHz over 2133MHz
    const ramPower = Math.ceil(ramSticks * (ramSpeed / 2133) * 1.5 * ramVoltage);
    powerBreakdown.ram = ramPower;
    totalPowerNeeded += ramPower;
  }
  
  // Storage Devices
  if (components.storage) {
    const storageType = extractComponentSpecs(components.storage, 'type') || 'SSD';
    const storagePower = storageType.toLowerCase() === 'hdd' ? 10 : 5; // HDDs use more power
    powerBreakdown.storage = storagePower;
    totalPowerNeeded += storagePower;
  }
  
  // Cooling
  if (components.cooler) {
    const coolerType = extractComponentSpecs(components.cooler, 'type') || 'air';
    const coolerPower = coolerType.toLowerCase() === 'aio' ? 15 : 5; // AIO coolers use more power
    powerBreakdown.cooling = coolerPower;
    totalPowerNeeded += coolerPower;
  }
  
  // Case fans and other peripherals
  const caseFans = extractComponentSpecs(components.case, 'fans') || 2;
  const fanPower = caseFans * 2; // 2W per fan
  powerBreakdown.fans = fanPower;
  totalPowerNeeded += fanPower;
  
  // USB and other peripherals
  powerBreakdown.peripherals = 20; // For USB devices, RGB, etc.
  totalPowerNeeded += 20;
  
  // Add 15% buffer for capacitor aging and efficiency loss
  totalPowerNeeded = Math.ceil(totalPowerNeeded * 1.15);
  
  // Check if PSU can handle the load
  const compatible = psuWattage >= totalPowerNeeded;
  const efficiencyFactor = {
    '80+': 0.8,
    '80+ Bronze': 0.82,
    '80+ Silver': 0.85,
    '80+ Gold': 0.87,
    '80+ Platinum': 0.89,
    '80+ Titanium': 0.92
  }[psuEfficiency] || 0.85; // Default to 85% efficiency
  
  const recommendedWattage = Math.ceil(totalPowerNeeded / efficiencyFactor);
  
  return {
    compatible,
    reason: compatible 
      ? `Sufficient power (${psuWattage}W PSU for ${totalPowerNeeded}W system load)`
      : `Insufficient power: ${psuWattage}W PSU for ${totalPowerNeeded}W system load (${recommendedWattage}W recommended)`,
    details: { 
      psuWattage, 
      totalPowerNeeded,
      recommendedWattage,
      efficiency: psuEfficiency,
      powerBreakdown 
    }
  };
};

// GPU-Case compatibility check
const checkGPUCaseCompatibility = (gpu, case_, motherboard) => {
  const gpuLength = extractComponentSpecs(gpu, 'length');
  const gpuWidth = extractComponentSpecs(gpu, 'width') || 120; // Default width in mm
  const gpuSlotThickness = extractComponentSpecs(gpu, 'slot_thickness') || 2; // Default to 2 slots
  const caseMaxLength = extractComponentSpecs(case_, 'max_gpu_length');
  const caseMaxWidth = extractComponentSpecs(case_, 'max_gpu_width') || 140; // Default max width in mm
  const caseMaxSlots = extractComponentSpecs(case_, 'expansion_slots') || 7; // Default PCIe slots
  
  const issues = [];
  const details = {
    gpuLength,
    gpuWidth,
    gpuSlotThickness,
    caseMaxLength,
    caseMaxWidth,
    caseMaxSlots
  };
  
  // Check GPU length
  if (gpuLength && caseMaxLength) {
    if (parseInt(gpuLength) > parseInt(caseMaxLength)) {
      issues.push(`GPU length (${gpuLength}mm) exceeds case maximum (${caseMaxLength}mm)`);
    }
  }
  
  // Check GPU width (for wide cards)
  if (parseInt(gpuWidth) > parseInt(caseMaxWidth)) {
    issues.push(`GPU width (${gpuWidth}mm) exceeds case maximum (${caseMaxWidth}mm)`);
  }
  
  // Check PCIe slot requirements
  if (parseInt(gpuSlotThickness) > 2) {
    const requiredSlots = Math.ceil(parseInt(gpuSlotThickness) / 2) * 2; // Round up to even number
    if (requiredSlots > parseInt(caseMaxSlots)) {
      issues.push(`GPU requires ${requiredSlots} slots but case only has ${caseMaxSlots}`);
    }
  }
  
  // Check if motherboard has enough PCIe slots
  if (motherboard) {
    const pcieSlots = extractComponentSpecs(motherboard, 'pcie_slots') || 1;
    if (pcieSlots < 1) {
      issues.push('Motherboard has no available PCIe slots');
    }
  }
  
  // Check for vertical GPU mounting
  const verticalMount = extractComponentSpecs(case_, 'vertical_gpu_mount');
  if (verticalMount === false && gpuSlotThickness > 2) {
    issues.push('Case does not support vertical GPU mounting for thick cards');
  }
  
  // Return results
  if (issues.length > 0) {
    return {
      compatible: false,
      reason: issues.join('; '),
      details
    };
  }
  
  // If we get here, all checks passed
  return {
    compatible: true,
    reason: 'GPU is compatible with case',
    details
  };
};

// Filter components based on selected components
export const filterCompatibleComponents = (allComponents, selectedComponents, targetCategory) => {
  if (!allComponents || allComponents.length === 0) return { compatible: [], incompatible: [] };
  
  const compatible = [];
  const incompatible = [];
  
  allComponents.forEach(component => {
    const compatibility = checkComponentCompatibility(component, selectedComponents, targetCategory);
    
    if (compatibility.compatible) {
      compatible.push({ ...component, compatibility });
    } else {
      incompatible.push({ ...component, compatibility });
    }
  });
  
  return { compatible, incompatible };
};

// Check if a specific component is compatible with current selections
const checkComponentCompatibility = (component, selectedComponents, targetCategory) => {
  const issues = [];
  let overallCompatible = true;
  
  // Check compatibility based on target category
  switch (targetCategory) {
    case 'motherboard':
      if (selectedComponents.cpu) {
        const cpuMoboCheck = checkCPUMotherboardCompatibility(selectedComponents.cpu, component);
        if (!cpuMoboCheck.compatible) {
          issues.push(cpuMoboCheck.reason);
          overallCompatible = false;
        }
      }
      break;
      
    case 'ram':
      if (selectedComponents.motherboard) {
        const ramMoboCheck = checkRAMMotherboardCompatibility(component, selectedComponents.motherboard);
        if (!ramMoboCheck.compatible) {
          issues.push(ramMoboCheck.reason);
          overallCompatible = false;
        }
      }
      
      // Check CPU-RAM compatibility
      if (selectedComponents.cpu) {
        const cpuRamCheck = checkCPURAMCompatibility(selectedComponents.cpu, component);
        if (!cpuRamCheck.compatible) {
          issues.push(cpuRamCheck.reason);
          overallCompatible = false;
        }
      }
      break;
      
    case 'case':
      if (selectedComponents.motherboard) {
        const caseMoboCheck = checkCaseMotherboardCompatibility(component, selectedComponents.motherboard);
        if (!caseMoboCheck.compatible) {
          issues.push(caseMoboCheck.reason);
          overallCompatible = false;
        }
      }
      break;
      
    case 'psu':
      const psuCheck = checkPSUPowerCompatibility(component, selectedComponents);
      if (!psuCheck.compatible) {
        issues.push(psuCheck.reason);
        overallCompatible = false;
      }
      break;
      
    case 'gpu':
      if (selectedComponents.case) {
        // Check GPU-case compatibility with motherboard context if available
        const gpuCaseCheck = selectedComponents.motherboard 
          ? checkGPUCaseCompatibility(component, selectedComponents.case, selectedComponents.motherboard)
          : checkGPUCaseCompatibility(component, selectedComponents.case);
          
        if (!gpuCaseCheck.compatible) {
          issues.push(gpuCaseCheck.reason);
          overallCompatible = false;
        }
        
        // Additional GPU power check if PSU is selected
        if (selectedComponents.psu) {
          const powerCheck = checkPSUPowerCompatibility(selectedComponents.psu, {
            ...selectedComponents,
            gpu: component // Test with the new GPU
          });
          if (!powerCheck.compatible) {
            issues.push(powerCheck.reason);
            overallCompatible = false;
          }
        }
      }
      break;
      
    case 'cooler':
      if (selectedComponents.case) {
        const coolerCaseCheck = checkCoolerCaseCompatibility(component, selectedComponents.case);
        if (!coolerCaseCheck.compatible) {
          issues.push(coolerCaseCheck.reason);
          overallCompatible = false;
        }
      }
      break;
  }
  
  return {
    compatible: overallCompatible,
    issues,
    reason: issues.length > 0 ? issues.join('; ') : 'Compatible with current selections'
  };
};

// Get compatibility score for current build
export const getCompatibilityScore = (selectedComponents) => {
  const checks = [];
  let totalChecks = 0;
  let passedChecks = 0;
  
  // CPU-Motherboard check
  if (selectedComponents.cpu && selectedComponents.motherboard) {
    totalChecks++;
    const check = checkCPUMotherboardCompatibility(selectedComponents.cpu, selectedComponents.motherboard);
    checks.push({ type: 'cpu_motherboard', ...check });
    if (check.compatible) passedChecks++;
  }
  
  // RAM-Motherboard check
  if (selectedComponents.ram && selectedComponents.motherboard) {
    totalChecks++;
    const check = checkRAMMotherboardCompatibility(selectedComponents.ram, selectedComponents.motherboard);
    checks.push({ type: 'ram_motherboard', ...check });
    if (check.compatible) passedChecks++;
  }
  
  // Case-Motherboard check
  if (selectedComponents.case && selectedComponents.motherboard) {
    totalChecks++;
    const check = checkCaseMotherboardCompatibility(selectedComponents.case, selectedComponents.motherboard);
    checks.push({ type: 'case_motherboard', ...check });
    if (check.compatible) passedChecks++;
  }
  
  // PSU Power check
  if (selectedComponents.psu) {
    totalChecks++;
    const check = checkPSUPowerCompatibility(selectedComponents.psu, selectedComponents);
    checks.push({ type: 'psu_power', ...check });
    if (check.compatible) passedChecks++;
  }
  
  // GPU-Case check
  if (selectedComponents.gpu && selectedComponents.case) {
    totalChecks++;
    const check = checkGPUCaseCompatibility(selectedComponents.gpu, selectedComponents.case);
    checks.push({ type: 'gpu_case', ...check });
    if (check.compatible) passedChecks++;
  }
  
  // Cooler-Case check
  if (selectedComponents.cooler && selectedComponents.case) {
    totalChecks++;
    const check = checkCoolerCaseCompatibility(selectedComponents.cooler, selectedComponents.case);
    checks.push({ type: 'cooler_case', ...check });
    if (check.compatible) passedChecks++;
  }
  
  // If no components are selected, return 0 score
  const hasAnyComponents = Object.values(selectedComponents).some(component => 
    component !== null && component !== undefined && 
    typeof component === 'object' && Object.keys(component).length > 0 &&
    component.id && component.name
  );
  
  const score = !hasAnyComponents ? 0 : (totalChecks > 0 ? Math.round((passedChecks / totalChecks) * 100) : 100);
  
  return {
    score,
    totalChecks,
    passedChecks,
    checks
  };
};

// Predict compatibility for future categories
export const predictCompatibilityForCategory = (selectedComponents, targetCategory) => {
  const predictions = {
    compatibilityRate: 0.8, // Default 80% compatibility
    potentialIssues: [],
    recommendations: []
  };

  // CPU-based predictions
  if (selectedComponents.cpu) {
    const cpuName = selectedComponents.cpu.name?.toLowerCase() || '';
    const cpuSocket = extractComponentSpecs(selectedComponents.cpu, 'socket');
    const cpuBrand = extractComponentSpecs(selectedComponents.cpu, 'brand');

    switch (targetCategory) {
      case 'motherboard':
        if (cpuSocket) {
          predictions.compatibilityRate = 0.9; // High compatibility if socket is known
          predictions.recommendations.push(`Look for ${cpuSocket} motherboards`);
        } else if (cpuBrand) {
          predictions.compatibilityRate = 0.7; // Medium compatibility based on brand
          predictions.recommendations.push(`Look for ${cpuBrand} motherboards`);
        } else {
          predictions.compatibilityRate = 0.5; // Lower compatibility if no info
          predictions.potentialIssues.push('Socket information not available');
        }
        break;

             case 'ram':
         if (cpuName.includes('ryzen')) {
           predictions.compatibilityRate = 0.95; // High compatibility for Ryzen
           predictions.recommendations.push('DDR4 RAM recommended for Ryzen');
           predictions.recommendations.push('Most DDR4 RAM modules will work');
         } else if (cpuName.includes('i7-11700') || cpuName.includes('i5-11600')) {
           predictions.compatibilityRate = 0.95; // High compatibility for Intel
           predictions.recommendations.push('DDR4 RAM recommended for Intel 11th gen');
           predictions.recommendations.push('Most DDR4 RAM modules will work');
         } else {
           predictions.compatibilityRate = 0.9; // High compatibility for other CPUs
           predictions.recommendations.push('Most DDR4 RAM modules are compatible');
         }
         break;

      case 'gpu':
        predictions.compatibilityRate = 0.95; // GPUs are generally compatible
        break;

      case 'psu':
        if (cpuName.includes('i7') || cpuName.includes('i9')) {
          predictions.compatibilityRate = 0.8;
          predictions.recommendations.push('Consider 650W+ PSU for high-end CPU');
        } else {
          predictions.compatibilityRate = 0.9;
          predictions.recommendations.push('500W+ PSU should be sufficient');
        }
        break;

      case 'case':
        predictions.compatibilityRate = 0.9; // Cases are generally compatible
        break;

      case 'cooler':
        if (cpuSocket) {
          predictions.compatibilityRate = 0.85;
          predictions.recommendations.push(`Look for ${cpuSocket} compatible coolers`);
        }
        break;
    }
  }

  // Motherboard-based predictions
  if (selectedComponents.motherboard && targetCategory === 'ram') {
    const moboRamType = extractComponentSpecs(selectedComponents.motherboard, 'ram_type');
    if (moboRamType) {
      predictions.compatibilityRate = 0.95;
      predictions.recommendations.push(`Look for ${moboRamType} RAM`);
      predictions.recommendations.push('Most RAM brands are compatible');
    } else {
      // If motherboard doesn't specify RAM type, assume high compatibility
      predictions.compatibilityRate = 0.9;
      predictions.recommendations.push('Most DDR4 RAM modules will work');
      predictions.recommendations.push('Check motherboard manual for specific requirements');
    }
  }

  // Case-based predictions
  if (selectedComponents.case && targetCategory === 'gpu') {
    predictions.compatibilityRate = 0.9; // High compatibility for GPU
    predictions.recommendations.push('Check GPU length compatibility');
    predictions.recommendations.push('Most GPUs fit in standard cases');
  }

  if (selectedComponents.case && targetCategory === 'cooler') {
    predictions.compatibilityRate = 0.9; // High compatibility for cooler
    predictions.recommendations.push('Check cooler height compatibility');
    predictions.recommendations.push('Most coolers fit in standard cases');
  }

  // Case compatibility predictions
  if (targetCategory === 'case') {
    if (selectedComponents.motherboard) {
      predictions.compatibilityRate = 0.95; // Very high compatibility for cases
      predictions.recommendations.push('Most cases are compatible with your motherboard');
      predictions.recommendations.push('Look for ATX, Micro-ATX, or Mini-ITX cases');
      predictions.recommendations.push('Gaming cases offer good airflow and compatibility');
    } else {
      predictions.compatibilityRate = 0.9; // High compatibility even without motherboard
      predictions.recommendations.push('Most cases work with standard motherboards');
      predictions.recommendations.push('ATX cases offer the best compatibility');
    }
  }

  return predictions;
};

// Get smart component recommendations
export const getSmartRecommendations = (selectedComponents, currentCategory) => {
  const recommendations = [];

  // CPU recommendations based on compatibility
  if (currentCategory === 'cpu') {
    recommendations.push({
      name: 'AMD Ryzen 5 5600G',
      reason: 'Excellent compatibility with most motherboards and RAM',
      price: '₱7,840',
      compatibility: 'High',
      benefits: ['AM4 socket', 'Integrated graphics', 'Good value']
    });
    recommendations.push({
      name: 'Intel Core i5-11600',
      reason: 'Good balance of performance and compatibility',
      price: '₱12,500',
      compatibility: 'High',
      benefits: ['LGA1200 socket', 'Strong performance', 'Wide motherboard support']
    });
  }

  // Motherboard recommendations
  if (currentCategory === 'motherboard' && selectedComponents.cpu) {
    const cpuSocket = extractComponentSpecs(selectedComponents.cpu, 'socket');
    if (cpuSocket === 'Intel LGA1200') {
      recommendations.push({
        name: 'MSI B560M PRO-VDH',
        reason: 'Perfect match for Intel 11th gen CPUs',
        price: '₱4,500',
        compatibility: 'Excellent',
        benefits: ['LGA1200 socket', 'DDR4 support', 'Good features']
      });
    } else if (cpuSocket === 'AMD AM4') {
      recommendations.push({
        name: 'MSI B550M PRO-VDH',
        reason: 'Great for AMD Ryzen processors',
        price: '₱4,200',
        compatibility: 'Excellent',
        benefits: ['AM4 socket', 'DDR4 support', 'PCIe 4.0']
      });
    }
  }

  // RAM recommendations
  if (currentCategory === 'ram') {
    // Universal RAM recommendations that work with most systems
    recommendations.push({
      name: 'Kingston Fury Beast 8GB DDR4 3200MHz',
      reason: 'Excellent compatibility with most motherboards',
      price: '₱1,800',
      compatibility: 'High',
      benefits: ['DDR4 3200MHz', 'Widely compatible', 'Good performance']
    });
    
    recommendations.push({
      name: 'Corsair Vengeance LPX 8GB DDR4 3200MHz',
      reason: 'High compatibility and reliable performance',
      price: '₱2,100',
      compatibility: 'High',
      benefits: ['DDR4 3200MHz', 'Low profile', 'Stable performance']
    });

    recommendations.push({
      name: 'G.Skill Ripjaws V 8GB DDR4 3200MHz',
      reason: 'Great value with good compatibility',
      price: '₱1,950',
      compatibility: 'High',
      benefits: ['DDR4 3200MHz', 'Good value', 'Reliable']
    });

    // If we have specific motherboard info, add targeted recommendations
    if (selectedComponents.motherboard) {
      const moboBrand = extractComponentSpecs(selectedComponents.motherboard, 'brand');
      if (moboBrand) {
        recommendations.push({
          name: `${moboBrand} Compatible RAM`,
          reason: `Specifically tested with ${moboBrand} motherboards`,
          price: '₱2,000',
          compatibility: 'Excellent',
          benefits: ['Brand tested', 'Guaranteed compatibility', 'Optimized performance']
        });
      }
    }
  }

  // Case recommendations
  if (currentCategory === 'case') {
    // Universal case recommendations that work with most systems
    recommendations.push({
      name: 'NZXT H510 Flow',
      reason: 'Excellent airflow and compatibility with most motherboards',
      price: '₱4,500',
      compatibility: 'High',
      benefits: ['ATX compatible', 'Great airflow', 'Modern design']
    });
    
    recommendations.push({
      name: 'Phanteks P300A',
      reason: 'High compatibility and excellent cooling performance',
      price: '₱3,800',
      compatibility: 'High',
      benefits: ['ATX/Micro-ATX', 'Mesh front panel', 'Good value']
    });

    recommendations.push({
      name: 'Fractal Design Focus G',
      reason: 'Great compatibility and build quality',
      price: '₱4,200',
      compatibility: 'High',
      benefits: ['ATX compatible', 'Quiet operation', 'Easy to build in']
    });

    // If we have specific motherboard info, add targeted recommendations
    if (selectedComponents.motherboard) {
      const moboFormFactor = extractComponentSpecs(selectedComponents.motherboard, 'form_factor');
      if (moboFormFactor) {
        recommendations.push({
          name: `${moboFormFactor} Optimized Case`,
          reason: `Specifically designed for ${moboFormFactor} motherboards`,
          price: '₱4,000',
          compatibility: 'Excellent',
          benefits: ['Form factor optimized', 'Perfect fit', 'Efficient space usage']
        });
      }
    }
  }

  return recommendations;
};

// Specialized RAM compatibility helper
export const getRAMCompatibilityGuidance = (selectedComponents) => {
  const guidance = {
    compatibilityLevel: 'high',
    recommendations: [],
    troubleshooting: [],
    fallbackOptions: []
  };

  // Analyze current selections
  const cpu = selectedComponents.cpu;
  const motherboard = selectedComponents.motherboard;

  if (cpu && motherboard) {
    const cpuName = cpu.name?.toLowerCase() || '';
    const cpuSocket = extractComponentSpecs(cpu, 'socket');
    const moboRamType = extractComponentSpecs(motherboard, 'ram_type');

    // CPU-based guidance
    if (cpuName.includes('ryzen')) {
      guidance.recommendations.push('AMD Ryzen CPUs work well with DDR4 RAM');
      guidance.recommendations.push('Look for DDR4 3200MHz or 3600MHz for best performance');
      guidance.fallbackOptions.push('Any DDR4 RAM module should work');
    } else if (cpuName.includes('i7-11700') || cpuName.includes('i5-11600')) {
      guidance.recommendations.push('Intel 11th gen CPUs are compatible with DDR4');
      guidance.recommendations.push('DDR4 3200MHz is recommended for optimal performance');
      guidance.fallbackOptions.push('Most DDR4 RAM modules are compatible');
    }

    // Motherboard-based guidance
    if (moboRamType) {
      guidance.recommendations.push(`Your motherboard supports ${moboRamType}`);
      guidance.recommendations.push(`Look for ${moboRamType} RAM modules`);
    } else {
      guidance.recommendations.push('Your motherboard likely supports DDR4');
      guidance.recommendations.push('Most DDR4 RAM modules will work');
    }

    // Troubleshooting tips
    guidance.troubleshooting.push('If no RAM shows as compatible, try showing all components');
    guidance.troubleshooting.push('Most DDR4 RAM is compatible with modern motherboards');
    guidance.troubleshooting.push('Check motherboard manual for specific RAM requirements');
    guidance.troubleshooting.push('Consider RAM speed compatibility (3200MHz is usually safe)');

    // Fallback options
    guidance.fallbackOptions.push('Kingston Fury Beast DDR4 3200MHz');
    guidance.fallbackOptions.push('Corsair Vengeance LPX DDR4 3200MHz');
    guidance.fallbackOptions.push('G.Skill Ripjaws V DDR4 3200MHz');
    guidance.fallbackOptions.push('Any major brand DDR4 RAM should work');

  } else if (cpu) {
    // Only CPU selected
    guidance.recommendations.push('Select a motherboard first for specific RAM recommendations');
    guidance.recommendations.push('Most modern CPUs work with DDR4 RAM');
    guidance.fallbackOptions.push('DDR4 3200MHz RAM is generally safe');
  }

  return guidance;
};

// Specialized case compatibility helper
export const getCaseCompatibilityGuidance = (selectedComponents) => {
  const guidance = {
    compatibilityLevel: 'high',
    recommendations: [],
    troubleshooting: [],
    fallbackOptions: []
  };

  // Analyze current selections
  const motherboard = selectedComponents.motherboard;
  const gpu = selectedComponents.gpu;
  const cooler = selectedComponents.cooler;

  if (motherboard) {
    const moboFormFactor = extractComponentSpecs(motherboard, 'form_factor');
    const moboBrand = extractComponentSpecs(motherboard, 'brand');

    // Motherboard-based guidance
    if (moboFormFactor) {
      guidance.recommendations.push(`Your motherboard is ${moboFormFactor} format`);
      guidance.recommendations.push(`Look for cases that support ${moboFormFactor} motherboards`);
      
      if (moboFormFactor === 'ATX') {
        guidance.recommendations.push('ATX cases offer the best compatibility and airflow');
        guidance.fallbackOptions.push('Any ATX case will work');
      } else if (moboFormFactor === 'Micro-ATX') {
        guidance.recommendations.push('Micro-ATX cases are compact and efficient');
        guidance.fallbackOptions.push('ATX and Micro-ATX cases will work');
      } else if (moboFormFactor === 'Mini-ITX') {
        guidance.recommendations.push('Mini-ITX cases are very compact');
        guidance.fallbackOptions.push('Most cases support Mini-ITX');
      }
    } else {
      guidance.recommendations.push('Your motherboard likely supports standard case formats');
      guidance.recommendations.push('ATX cases offer the best compatibility');
    }

    // Brand-based guidance
    if (moboBrand) {
      guidance.recommendations.push(`Your ${moboBrand} motherboard works with most cases`);
    }
  }

  // GPU-based guidance
  if (gpu) {
    guidance.recommendations.push('Consider GPU length when selecting a case');
    guidance.recommendations.push('Most modern cases support long graphics cards');
    guidance.fallbackOptions.push('Look for cases with 300mm+ GPU clearance');
  }

  // Cooler-based guidance
  if (cooler) {
    guidance.recommendations.push('Consider cooler height when selecting a case');
    guidance.recommendations.push('Most cases support standard air coolers');
    guidance.fallbackOptions.push('Look for cases with 160mm+ cooler clearance');
  }

  // Troubleshooting tips
  guidance.troubleshooting.push('If no cases show as compatible, try showing all components');
  guidance.troubleshooting.push('Most ATX cases work with most motherboards');
  guidance.troubleshooting.push('Check case specifications for motherboard support');
  guidance.troubleshooting.push('Consider airflow and cable management features');

  // Fallback options
  guidance.fallbackOptions.push('NZXT H510 Flow - Excellent ATX compatibility');
  guidance.fallbackOptions.push('Phanteks P300A - Great Micro-ATX support');
  guidance.fallbackOptions.push('Fractal Design Focus G - Universal compatibility');
  guidance.fallbackOptions.push('Any major brand ATX case should work');

  return guidance;
};

// CPU-RAM compatibility check
const checkCPURAMCompatibility = (cpu, ram) => {
  const cpuSocket = extractComponentSpecs(cpu, 'socket');
  const ramType = extractComponentSpecs(ram, 'ram_type');
  const ramSpeed = extractComponentSpecs(ram, 'speed');
  
  const issues = [];
  const details = { cpuSocket, ramType, ramSpeed };
  
  // Check CPU-RAM type compatibility
  if (cpuSocket && ramType) {
    const supportedRamTypes = COMPATIBILITY_RULES.cpu_ram_compatibility[cpuSocket];
    if (supportedRamTypes && !supportedRamTypes.includes(ramType)) {
      issues.push(`CPU socket ${cpuSocket} does not support ${ramType} RAM`);
    }
  }
  
  // Check RAM speed compatibility with CPU
  if (ramSpeed && cpuSocket) {
    const ramSpeedNum = parseInt(ramSpeed);
    const ramTypeForSpeed = ramType || 'DDR4'; // Default to DDR4 if not specified
    
    if (COMPATIBILITY_RULES.ram_speeds[ramTypeForSpeed]) {
      const speedRules = COMPATIBILITY_RULES.ram_speeds[ramTypeForSpeed];
      
      if (ramSpeedNum < speedRules.min) {
        issues.push(`RAM speed (${ramSpeed}MHz) is below minimum for ${ramTypeForSpeed} (${speedRules.min}MHz)`);
      } else if (ramSpeedNum > speedRules.max) {
        issues.push(`RAM speed (${ramSpeed}MHz) exceeds maximum for ${ramTypeForSpeed} (${speedRules.max}MHz)`);
      }
    }
  }
  
  // CPU-specific RAM recommendations
  const cpuName = cpu.name?.toLowerCase() || '';
  if (cpuName.includes('ryzen')) {
    if (ramSpeed && parseInt(ramSpeed) < 3000) {
      issues.push('Warning: Ryzen CPUs benefit from faster RAM (3000MHz+)');
    }
  }
  
  if (cpuName.includes('i7-11700') || cpuName.includes('i5-11600')) {
    if (ramSpeed && parseInt(ramSpeed) < 2666) {
      issues.push('Warning: Intel 11th gen CPUs work better with faster RAM (2666MHz+)');
    }
  }
  
  // Return results
  if (issues.length > 0) {
    const criticalIssues = issues.filter(issue => !issue.startsWith('Warning:'));
    return {
      compatible: criticalIssues.length === 0,
      reason: issues.join('; '),
      details,
      warnings: issues.filter(issue => issue.startsWith('Warning:')).length
    };
  }
  
  return {
    compatible: true,
    reason: 'RAM is compatible with CPU',
    details
  };
};

// Check compatibility between a CPU cooler and a case
const checkCoolerCaseCompatibility = (cooler, case_) => {
  const coolerSpecs = extractComponentSpecs(cooler, 'cooler');
  const caseSpecs = extractComponentSpecs(case_, 'case');
  
  // If we can't determine the specs, assume compatibility
  if (!coolerSpecs || !caseSpecs) {
    return { compatible: true };
  }
  
  // Check for liquid cooling radiator support if it's a liquid cooler
  if (coolerSpecs.type && coolerSpecs.type.toLowerCase().includes('liquid')) {
    const radSizeMatch = coolerSpecs.name.match(/(\d+)mm/);
    if (radSizeMatch) {
      const radSize = parseInt(radSizeMatch[1]);
      const radSizeStr = `${radSize}mm`;
      
      // Check if case supports this radiator size
      if (caseSpecs.radiatorSupport) {
        const supportedRadSizes = caseSpecs.radiatorSupport.split(',').map(s => s.trim());
        if (!supportedRadSizes.includes(radSizeStr)) {
          return {
            compatible: false,
            reason: `Case does not support ${radSize}mm radiator`
          };
        }
      } else {
        // If we can't determine radiator support, assume compatibility
        return { compatible: true };
      }
    }
  }
  
  // Check for air cooler height clearance if it's an air cooler
  if (coolerSpecs.type && 
      (coolerSpecs.type.toLowerCase().includes('air') || 
       !coolerSpecs.type.toLowerCase().includes('liquid'))) {
    
    const coolerHeightMatch = coolerSpecs.name.match(/(\d+)mm/);
    if (coolerHeightMatch && caseSpecs.maxCoolerHeight) {
      const coolerHeight = parseInt(coolerHeightMatch[1]);
      const maxHeight = parseInt(caseSpecs.maxCoolerHeight);
      
      if (coolerHeight > maxHeight) {
        return {
          compatible: false,
          reason: `Cooler height (${coolerHeight}mm) exceeds case maximum (${maxHeight}mm)`
        };
      }
    }
  }
  
  return { compatible: true };
};

export default {
  checkCompatibility,
  filterCompatibleComponents,
  getCompatibilityScore,
  extractComponentSpecs,
  predictCompatibilityForCategory,
  getSmartRecommendations,
  getRAMCompatibilityGuidance,
  getCaseCompatibilityGuidance,
  checkCoolerCaseCompatibility
};
