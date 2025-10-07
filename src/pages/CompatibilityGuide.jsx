import React, { useState } from 'react';
import { ArrowLeft, CheckCircle, XCircle, AlertTriangle, Info, Cpu, HardDrive, MemoryStick, Zap, Package, Thermometer } from 'lucide-react';

const CompatibilityGuide = ({ setCurrentPage }) => {
  const [activeSection, setActiveSection] = useState('cpu-motherboard');

  const compatibilitySections = [
    {
      id: 'cpu-motherboard',
      title: 'CPU & Motherboard',
      icon: <Cpu className="w-6 h-6" />,
      critical: true,
      content: {
        description: 'The most critical compatibility check - ensuring your CPU and motherboard have matching sockets.',
        checks: [
          {
            name: 'Socket Compatibility',
            description: 'CPU socket must match motherboard socket exactly',
            examples: [
              { cpu: 'Intel Core i5-12400F', socket: 'LGA1700', compatible: true },
              { cpu: 'AMD Ryzen 5 5600X', socket: 'AM4', compatible: true },
              { cpu: 'Intel Core i7-12700K', socket: 'LGA1700', compatible: true }
            ],
            tips: [
              'Intel LGA1700 works with 12th and 13th gen Intel CPUs',
              'AMD AM4 works with Ryzen 3000, 4000, and 5000 series',
              'AMD AM5 works with Ryzen 7000 series and newer',
              'Always check the exact socket before purchasing'
            ]
          }
        ]
      }
    },
    {
      id: 'ram-motherboard',
      title: 'RAM & Motherboard',
      icon: <MemoryStick className="w-6 h-6" />,
      critical: true,
      content: {
        description: 'Ensuring your RAM type and speed are supported by your motherboard.',
        checks: [
          {
            name: 'RAM Type Compatibility',
            description: 'RAM type (DDR4/DDR5) must match motherboard support',
            examples: [
              { ram: 'DDR4-3200', motherboard: 'DDR4 Support', compatible: true },
              { ram: 'DDR5-5600', motherboard: 'DDR5 Support', compatible: true },
              { ram: 'DDR4-3200', motherboard: 'DDR5 Only', compatible: false }
            ],
            tips: [
              'DDR4 and DDR5 are not interchangeable',
              'Check motherboard specifications for supported RAM types',
              'Higher speed RAM may run at lower speeds if not supported',
              'Consider future upgradeability when choosing RAM type'
            ]
          },
          {
            name: 'RAM Speed Support',
            description: 'Motherboard must support the RAM speed you choose',
            examples: [
              { ram: 'DDR4-3600', motherboard: 'DDR4-3200 Max', compatible: false },
              { ram: 'DDR4-3200', motherboard: 'DDR4-3600 Max', compatible: true }
            ],
            tips: [
              'RAM will run at the lowest supported speed',
              'Check motherboard QVL (Qualified Vendor List)',
              'XMP/DOCP profiles may be required for higher speeds'
            ]
          }
        ]
      }
    },
    {
      id: 'storage-interface',
      title: 'Storage & Motherboard',
      icon: <HardDrive className="w-6 h-6" />,
      critical: true,
      content: {
        description: 'Ensuring your storage drives are compatible with motherboard interfaces.',
        checks: [
          {
            name: 'Storage Interface Support',
            description: 'Motherboard must have the right connectors for your storage',
            examples: [
              { storage: 'NVMe SSD', interface: 'M.2 NVMe', compatible: true },
              { storage: 'SATA SSD', interface: 'SATA', compatible: true },
              { storage: 'NVMe SSD', interface: 'SATA Only', compatible: false }
            ],
            tips: [
              'M.2 slots can support both SATA and NVMe drives',
              'Check motherboard specifications for M.2 slot types',
              'Some M.2 slots share bandwidth with SATA ports',
              'Consider future storage needs when choosing motherboard'
            ]
          }
        ]
      }
    },
    {
      id: 'psu-power',
      title: 'Power Supply',
      icon: <Zap className="w-6 h-6" />,
      critical: true,
      content: {
        description: 'Ensuring your power supply can handle all your components safely.',
        checks: [
          {
            name: 'Wattage Requirements',
            description: 'PSU must provide enough power for all components',
            examples: [
              { components: 'RTX 4080 + i7-12700K', psu: '850W', compatible: true },
              { components: 'RTX 4090 + i9-13900K', psu: '750W', compatible: false },
              { components: 'RTX 3060 + i5-12400', psu: '650W', compatible: true }
            ],
            tips: [
              'Add 20-30% buffer to calculated power requirements',
              'High-end GPUs require more power than CPUs',
              'Consider future upgrades when choosing PSU wattage',
              'Efficiency rating (80+ Gold, etc.) affects actual power delivery'
            ]
          },
          {
            name: 'PSU Form Factor',
            description: 'PSU must fit in your case',
            examples: [
              { psu: 'ATX PSU', case: 'ATX Case', compatible: true },
              { psu: 'SFX PSU', case: 'Mini-ITX Case', compatible: true },
              { psu: 'ATX PSU', case: 'Mini-ITX Case', compatible: false }
            ],
            tips: [
              'Check case specifications for supported PSU sizes',
              'SFX PSUs are smaller but more expensive',
              'Modular PSUs help with cable management',
              'Consider cable length for larger cases'
            ]
          }
        ]
      }
    },
    {
      id: 'case-motherboard',
      title: 'Case & Motherboard',
      icon: <Package className="w-6 h-6" />,
      critical: true,
      content: {
        description: 'Ensuring your case can accommodate your motherboard and components.',
        checks: [
          {
            name: 'Form Factor Compatibility',
            description: 'Case must support your motherboard form factor',
            examples: [
              { motherboard: 'ATX', case: 'ATX Case', compatible: true },
              { motherboard: 'Micro-ATX', case: 'ATX Case', compatible: true },
              { motherboard: 'ATX', case: 'Micro-ATX Case', compatible: false }
            ],
            tips: [
              'Larger cases can accommodate smaller motherboards',
              'Check case specifications for supported form factors',
              'Consider future motherboard upgrades',
              'Smaller cases may have limited expansion options'
            ]
          },
          {
            name: 'GPU Length Support',
            description: 'Case must have enough space for your graphics card',
            examples: [
              { gpu: 'RTX 4090 (304mm)', case: 'ATX Case (350mm)', compatible: true },
              { gpu: 'RTX 4090 (304mm)', case: 'Mini-ITX (280mm)', compatible: false }
            ],
            tips: [
              'Check case specifications for maximum GPU length',
              'Consider drive cages and other obstructions',
              'Some cases have removable drive cages for longer GPUs',
              'Measure twice, buy once!'
            ]
          }
        ]
      }
    },
    {
      id: 'cooling',
      title: 'CPU Cooling',
      icon: <Thermometer className="w-6 h-6" />,
      critical: false,
      content: {
        description: 'Ensuring your CPU cooler fits and provides adequate cooling.',
        checks: [
          {
            name: 'Socket Compatibility',
            description: 'Cooler must support your CPU socket',
            examples: [
              { cooler: 'Noctua NH-D15', socket: 'LGA1700', compatible: true },
              { cooler: 'AMD Wraith Prism', socket: 'AM4', compatible: true },
              { cooler: 'Intel Stock Cooler', socket: 'AM4', compatible: false }
            ],
            tips: [
              'Most coolers support multiple sockets with different mounting kits',
              'Check cooler specifications for supported sockets',
              'Some coolers may need separate mounting hardware',
              'AIO coolers have different mounting requirements'
            ]
          },
          {
            name: 'Height Clearance',
            description: 'Cooler must fit within case height limits',
            examples: [
              { cooler: 'Noctua NH-D15 (165mm)', case: 'ATX Case (170mm)', compatible: true },
              { cooler: 'Noctua NH-D15 (165mm)', case: 'Mini-ITX (160mm)', compatible: false }
            ],
            tips: [
              'Check case specifications for maximum cooler height',
              'Tower coolers are generally taller than low-profile coolers',
              'AIO coolers may have different clearance requirements',
              'Consider RAM height when choosing air coolers'
            ]
          }
        ]
      }
    }
  ];

  const getStatusIcon = (compatible) => {
    if (compatible) {
      return <CheckCircle className="w-5 h-5 text-green-600" />;
    }
    return <XCircle className="w-5 h-5 text-red-600" />;
  };

  const getStatusColor = (compatible) => {
    if (compatible) {
      return 'text-green-600';
    }
    return 'text-red-600';
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <div className="bg-white shadow-sm">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <button
              onClick={() => setCurrentPage('home')}
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Back to Home
            </button>
            <h1 className="text-2xl font-bold text-gray-900">Compatibility Guide</h1>
            <div></div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-8">
          {/* Sidebar Navigation */}
          <div className="lg:col-span-1">
            <div className="bg-white rounded-lg shadow-sm p-6 sticky top-8">
              <h3 className="text-lg font-semibold text-gray-900 mb-4">Compatibility Checks</h3>
              <nav className="space-y-2">
                {compatibilitySections.map((section) => (
                  <button
                    key={section.id}
                    onClick={() => setActiveSection(section.id)}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-lg text-left transition-colors ${
                      activeSection === section.id
                        ? 'bg-green-100 text-green-700'
                        : 'text-gray-600 hover:bg-gray-100'
                    }`}
                  >
                    {section.icon}
                    <span className="font-medium">{section.title}</span>
                    {section.critical && (
                      <AlertTriangle className="w-4 h-4 text-red-500 ml-auto" />
                    )}
                  </button>
                ))}
              </nav>
            </div>
          </div>

          {/* Main Content */}
          <div className="lg:col-span-3">
            {compatibilitySections.map((section) => (
              activeSection === section.id && (
                <div key={section.id} className="bg-white rounded-lg shadow-sm p-8">
                  <div className="flex items-center gap-3 mb-6">
                    {section.icon}
                    <h2 className="text-2xl font-bold text-gray-900">{section.title}</h2>
                    {section.critical && (
                      <span className="px-2 py-1 bg-red-100 text-red-700 text-xs font-medium rounded-full">
                        Critical
                      </span>
                    )}
                  </div>

                  <p className="text-gray-600 text-lg mb-8">{section.content.description}</p>

                  <div className="space-y-8">
                    {section.content.checks.map((check, index) => (
                      <div key={index} className="border border-gray-200 rounded-lg p-6">
                        <h3 className="text-xl font-semibold text-gray-900 mb-3">{check.name}</h3>
                        <p className="text-gray-600 mb-6">{check.description}</p>

                        {/* Examples */}
                        {check.examples && (
                          <div className="mb-6">
                            <h4 className="font-semibold text-gray-900 mb-3">Examples:</h4>
                            <div className="space-y-2">
                              {check.examples.map((example, exIndex) => (
                                <div key={exIndex} className="flex items-center gap-3 p-3 bg-gray-50 rounded-lg">
                                  {getStatusIcon(example.compatible)}
                                  <div className="flex-1">
                                    <span className="font-medium">{Object.keys(example)[0]}: </span>
                                    <span className="text-gray-700">{Object.values(example)[0]}</span>
                                    <span className="mx-2 text-gray-400">→</span>
                                    <span className="font-medium">{Object.keys(example)[1]}: </span>
                                    <span className="text-gray-700">{Object.values(example)[1]}</span>
                                  </div>
                                  <span className={`text-sm font-medium ${getStatusColor(example.compatible)}`}>
                                    {example.compatible ? 'Compatible' : 'Incompatible'}
                                  </span>
                                </div>
                              ))}
                            </div>
                          </div>
                        )}

                        {/* Tips */}
                        {check.tips && (
                          <div>
                            <h4 className="font-semibold text-gray-900 mb-3">Tips:</h4>
                            <ul className="space-y-2">
                              {check.tips.map((tip, tipIndex) => (
                                <li key={tipIndex} className="flex items-start gap-2">
                                  <Info className="w-4 h-4 text-blue-500 mt-1 flex-shrink-0" />
                                  <span className="text-gray-600">{tip}</span>
                                </li>
                              ))}
                            </ul>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )
            ))}
          </div>
        </div>

        {/* CTA Section */}
        <div className="mt-12 text-center">
          <div className="bg-green-50 rounded-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Ready to Build?</h3>
            <p className="text-gray-600 mb-6">
              Now that you understand compatibility, start building your perfect PC with our guided interface.
            </p>
            <button
              onClick={() => setCurrentPage('pc-assembly')}
              className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
            >
              Start PC Assembly
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default CompatibilityGuide;
