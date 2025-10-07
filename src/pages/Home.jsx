import React, { useState, useEffect } from 'react'
import { ArrowRight, Star, CheckCircle, Zap, Shield, Users, Award, ChevronDown, ChevronUp, HelpCircle, MessageSquare, Send, X, Cpu, Monitor, MemoryStick } from 'lucide-react'
import HeroSlideshow from '../components/HeroSlideshow'
import { API_BASE } from '../utils/apiBase'

const Home = ({ setCurrentPage, setSelectedComponents }) => {
  const [openFaq, setOpenFaq] = useState(null)
  const [showFeedbackModal, setShowFeedbackModal] = useState(false)
  const [feedbackRating, setFeedbackRating] = useState(0)
  const [feedbackCategory, setFeedbackCategory] = useState('')
  const [feedbackMessage, setFeedbackMessage] = useState('')
  const [feedbackSubmitted, setFeedbackSubmitted] = useState(false)
  const [prebuiltPCs, setPrebuiltPCs] = useState([])
  const [loadingPrebuilts, setLoadingPrebuilts] = useState(true)

  // Fetch prebuilts from database
  useEffect(() => {
    const fetchPrebuilts = async () => {
      try {
        const response = await fetch(`${API_BASE}/prebuilts.php`)
        const data = await response.json()
        if (Array.isArray(data)) {
          setPrebuiltPCs(data)
        } else {
          setPrebuiltPCs([])
        }
      } catch (error) {
        console.error('Error fetching prebuilts:', error)
        setPrebuiltPCs([])
      } finally {
        setLoadingPrebuilts(false)
      }
    }
    fetchPrebuilts()
  }, [])

  // Canonical key mapping for component categories
  const KEY_MAP = {
    cpu: ['cpu', 'processor', 'procie', 'procie only', 'processor only'],
    motherboard: ['motherboard', 'mobo'],
    gpu: ['gpu', 'graphics', 'graphics card', 'video', 'video card', 'vga'],
    ram: ['ram', 'memory', 'ddr', 'ddr4', 'ddr5'],
    storage: ['storage', 'ssd', 'nvme', 'hdd', 'hard drive', 'drive'],
    psu: ['psu', 'power supply', 'psu - tr', 'tr psu'],
    case: ['case', 'chassis', 'case gaming'],
    cooler: ['cooler', 'coolers', 'aio', 'cooling', 'cpu cooler', 'water cooling', 'liquid cooler', 'fan', 'heatsink']
  };

  // Helper to fetch full component objects by IDs
  async function fetchComponentsByIds(componentIds) {
    if (!componentIds || typeof componentIds !== 'object') return {};
    // Accept numeric strings and numbers
    const ids = Object.values(componentIds)
      .map(v => typeof v === 'string' ? parseInt(v, 10) : v)
      .filter(v => Number.isFinite(v) && v > 0);
    if (ids.length === 0) return {};
    const url = `${API_BASE}/get_components_by_ids.php?ids=${ids.join(',')}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.success && data.data) {
      const componentsByCategory = {};
      data.data.forEach(component => {
        const category = Object.keys(componentIds).find(cat => componentIds[cat] == component.id);
        if (category) {
          componentsByCategory[category] = component;
        }
      });
      return componentsByCategory;
    }
    return {};
  }

  // Fetch cheapest component for a given canonical category key (for fallbacks)
  async function fetchCheapestForCategory(canonKey) {
    const map = {
      cpu: 'CPU',
      motherboard: 'Motherboard',
      gpu: 'GPU',
      ram: 'RAM',
      storage: 'Storage',
      psu: 'PSU',
      case: 'Case',
      cooler: 'Cooler'
    };
    const category = map[canonKey];
    if (!category) return null;
    try {
      const url = `${API_BASE}/index.php?endpoint=components&category=${encodeURIComponent(category)}`;
      const res = await fetch(url);
      const data = await res.json();
      if (!data.success || !Array.isArray(data.data) || data.data.length === 0) return null;
      const items = data.data.slice();
      items.sort((a, b) => (Number(a.price) || 0) - (Number(b.price) || 0));
      return items[0] || null;
    } catch (e) {
      return null;
    }
  }

  const handlePrebuiltSelect = async (pc) => {
    try {
      // Parse component_ids from JSON string if it's a string
      let componentIds = {};
      if (pc.component_ids) {
        if (typeof pc.component_ids === 'string') {
          componentIds = JSON.parse(pc.component_ids);
        } else {
          componentIds = pc.component_ids;
        }
      } else if (pc.componentIds) {
        componentIds = pc.componentIds;
      }
      
      const componentsForEdit = await fetchComponentsByIds(componentIds);

      // Canonicalize keys to what PCAssembly expects
      const canon = {};
      const lowerKeys = Object.keys(componentsForEdit).reduce((acc, k) => { acc[k.toLowerCase()] = componentsForEdit[k]; return acc; }, {});
      Object.entries(KEY_MAP).forEach(([canonKey, aliases]) => {
        for (const a of aliases) {
          if (lowerKeys[a]) { canon[canonKey] = lowerKeys[a]; break; }
        }
      });
      // Keep any already canonical keys
      Object.keys(componentsForEdit).forEach((k) => {
        if (KEY_MAP[k]) canon[k] = componentsForEdit[k];
      });

      // If original prebuilt indicated cooler but it's missing, auto-fill a basic cooler
      const originalKeySet = Object.keys(componentIds || {}).map(k => k.toLowerCase());
      const intendedCooler = (KEY_MAP.cooler || []).some(alias => originalKeySet.includes(alias));
      if (intendedCooler && !canon.cooler) {
        const fallbackCooler = await fetchCheapestForCategory('cooler');
        if (fallbackCooler) canon.cooler = fallbackCooler;
      }

      // Ensure required categories exist; backfill with cheapest sensible options
      const required = ['cpu','motherboard','gpu','ram','storage','psu','case'];
      const missing = required.filter(k => !canon[k]);
      if (missing.length > 0) {
        const results = await Promise.all(missing.map(k => fetchCheapestForCategory(k)));
        results.forEach((comp, idx) => { if (comp) canon[missing[idx]] = comp; });
      }

      // Persist selection for consistency across navigation
      try {
        localStorage.setItem('builditpc-selected-components', JSON.stringify(canon));
        localStorage.setItem('builditpc-editing-build', JSON.stringify({
          name: (pc.name || 'Prebuilt') + ' (Prebuilt)',
          description: pc.description || ''
        }));
      } catch (e) {}

      if (setSelectedComponents) {
        setSelectedComponents(canon);
      }
      setCurrentPage('pc-assembly');
    } catch (error) {
      console.error('Error loading prebuilt components:', error);
      alert('Error loading prebuilt components. Please try again.');
    }
  }

  const features = [
    {
      icon: <Zap className="w-8 h-8" />,
      title: 'Lightning Fast',
      description: 'Build your dream PC in minutes with our intuitive interface'
    },
    {
      icon: <Shield className="w-8 h-8" />,
      title: '100% Compatible',
      description: 'Advanced compatibility checking ensures all parts work together'
    },
    {
      icon: <Users className="w-8 h-8" />,
      title: 'Expert Support',
      description: 'Get help from our PC building experts anytime'
    },
    {
      icon: <Award className="w-8 h-8" />,
      title: 'Best Prices',
      description: 'Competitive prices on all components and prebuilt systems'
    }
  ]

  const feedbackCategories = [
    { id: 'general', name: 'General Feedback', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    { id: 'bug', name: 'Bug Report', color: 'bg-red-50 text-red-700 border-red-200' },
    { id: 'feature', name: 'Feature Request', color: 'bg-green-50 text-green-700 border-green-200' },
    { id: 'compatibility', name: 'Compatibility Issue', color: 'bg-purple-50 text-purple-700 border-purple-200' },
    { id: 'pricing', name: 'Pricing Feedback', color: 'bg-yellow-50 text-yellow-700 border-yellow-200' },
    { id: 'ui', name: 'User Interface', color: 'bg-indigo-50 text-indigo-700 border-indigo-200' }
  ]

  const faqData = [
    {
      id: 1,
      question: "How does SIMS's compatibility checker work?",
      answer: "Our advanced compatibility checker uses a sophisticated algorithm that analyzes multiple aspects of your selected components in real-time. It checks CPU socket compatibility with motherboards (ensuring AM5 CPUs work with AM5 motherboards, LGA1700 with LGA1700, etc.), validates RAM type matching (DDR4 vs DDR5), calculates power supply wattage requirements based on component TDP ratings, and verifies case form factor compatibility. The system also considers physical dimensions, cooling requirements, and expansion slot availability. When you select components, the checker immediately updates the compatibility score and provides specific feedback on any issues, helping you make informed decisions before purchasing."
    },
    {
      id: 2,
      question: "Can I save my PC build for later?",
      answer: "Currently, SIMS operates as a real-time building and compatibility checking platform. While we don't have a persistent save feature yet, you can easily recreate your build by selecting the same components from our comprehensive database. We're actively developing build saving, sharing, and export features that will allow you to save multiple builds, share them with friends, export parts lists to retailers, and even receive notifications when component prices change. These features will be available in upcoming updates, making it easier to plan and compare different build configurations over time."
    },
    {
      id: 3,
      question: "Are the component prices on SIMS accurate?",
              answer: "The prices shown on SIMS are carefully researched market prices in Philippine Peso (₱) based on current retail data from major Philippine retailers and online marketplaces. However, actual prices may vary due to factors like regional availability, seasonal fluctuations, import duties, and retailer-specific promotions. We recommend using our prices as a baseline for budgeting and comparison, then checking with local retailers like PCHub, DynaQuest, EasyPC, or online platforms like Lazada and Shopee for the most current pricing. Our price estimates are updated regularly to reflect market trends and new product releases."
    },
    {
      id: 4,
      question: "How often is the component database updated?",
      answer: "Our component database is continuously updated through multiple channels. We add new CPU and GPU releases within 24-48 hours of their official announcement, update motherboard specifications as manufacturers release new models, and refresh pricing data weekly. Our team monitors major tech announcements, manufacturer websites, and retailer catalogs to ensure comprehensive coverage. We also update component specifications, compatibility rules, and performance benchmarks based on the latest reviews and testing data. This ensures you always have access to the most current information when making your build decisions, including the latest Intel 14th gen, AMD Ryzen 7000 series, and NVIDIA RTX 4000 series components."
    },
    {
      id: 5,
      question: "What if the compatibility checker shows issues with my build?",
      answer: "When compatibility issues are detected, our system provides detailed analysis and actionable solutions. For CPU-motherboard mismatches, we'll suggest compatible alternatives or explain the socket requirements. RAM compatibility issues include recommendations for the correct DDR4/DDR5 modules and supported speeds. Power supply warnings show your estimated power draw and suggest appropriate wattage ratings. Case compatibility issues detail form factor requirements and suggest suitable alternatives. The system also provides performance impact assessments, helping you understand how different component choices affect your build's capabilities. You can use our 'Find Compatible' feature to automatically suggest alternatives that resolve the conflicts while maintaining your performance goals."
    },
    {
      id: 6,
      question: "Can I use SIMS on mobile devices?",
              answer: "SIMS is fully responsive and optimized for all devices, including smartphones and tablets. The interface automatically adapts to your screen size, with touch-friendly buttons, swipe gestures for component browsing, and optimized layouts for smaller screens. While the desktop experience offers the most comprehensive view with side-by-side component comparison and detailed specifications, the mobile version provides full functionality for building and checking compatibility. You can browse components, check compatibility, view prebuilt recommendations, and access the FAQ section seamlessly on any device. The mobile interface prioritizes essential features while maintaining the same accuracy and reliability as the desktop version."
    },
    {
      id: 7,
      question: "How accurate are the prebuilt PC recommendations?",
      answer: "Our prebuilt PC recommendations are meticulously curated by a team of PC building experts who analyze market trends, performance benchmarks, and user requirements. Each system is tested for compatibility, performance, and value-for-money across different use cases. Gaming builds are optimized for frame rates and graphics performance, streaming builds balance CPU and GPU requirements for content creation, and workstation builds prioritize multi-core performance and reliability. We regularly update these recommendations based on new component releases, price changes, and performance improvements. Each prebuilt includes detailed specifications, estimated performance metrics, and upgrade paths, helping you understand exactly what you're getting and how it can be improved over time."
    },
    {
      id: 8,
      question: "Does SIMS provide assembly instructions?",
              answer: "While SIMS primarily focuses on component selection and compatibility checking, we provide comprehensive guidance throughout the PC building process. Our platform includes general assembly tips, component installation order recommendations, and common troubleshooting advice. For detailed step-by-step assembly instructions, we recommend consulting the manufacturer manuals that come with each component, as they contain specific installation procedures and safety guidelines. We also provide links to trusted assembly guides and video tutorials from reputable sources. For users who prefer professional assembly, we can recommend local PC building services and provide guidance on what to look for when choosing an assembler. Our goal is to make the entire PC building journey as smooth as possible, from planning to completion."
    },
    {
      id: 9,
      question: "Can I compare different component options side by side?",
      answer: "Yes! SIMS offers comprehensive component comparison features. You can preview individual components to see detailed specifications, performance benchmarks, and user reviews. The compatibility checker helps you understand how different component combinations work together, showing the impact of each choice on your overall build performance and compatibility. You can compare multiple CPUs, GPUs, or other components side-by-side to see differences in specifications, power consumption, and performance metrics. The system also provides performance estimates for different combinations, helping you make informed decisions based on your specific needs and budget. Whether you're choosing between AMD and Intel processors, different GPU tiers, or various storage options, our comparison tools help you understand the trade-offs and make the best choice for your build."
    },
    {
      id: 10,
      question: "Is SIMS free to use?",
              answer: "Yes, SIMS is completely free to use! All our core features are available at no cost, including the advanced compatibility checker, comprehensive component database, prebuilt PC recommendations, and all platform tools. We believe that PC building should be accessible to everyone, regardless of budget constraints. Our business model is supported through partnerships with retailers and manufacturers, allowing us to provide accurate pricing and product information while keeping the platform free for users. We're committed to maintaining this free access while continuously improving our features and expanding our component database. There are no hidden fees, premium tiers, or paid features - everything you need to build your perfect PC is available completely free of charge."
    }
  ]

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id)
  }

  const handleFeedbackSubmit = async (e) => {
    e.preventDefault()
    try {
      const res = await fetch(`${API_BASE}/submit_feedback.php`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          rating: feedbackRating,
          category: feedbackCategory,
          message: feedbackMessage,
        })
      })
      const data = await res.json().catch(() => ({}))
      if (data && data.success) {
        setFeedbackSubmitted(true)
        setTimeout(() => {
          setFeedbackSubmitted(false)
          setFeedbackRating(0)
          setFeedbackCategory('')
          setFeedbackMessage('')
          setShowFeedbackModal(false)
        }, 2000)
      } else {
        alert('Failed to submit feedback. Please try again later.')
      }
    } catch (err) {
      console.error('Feedback submit error:', err)
      alert('Failed to submit feedback. Please try again later.')
    }
  }

  const resetFeedbackForm = () => {
    setFeedbackRating(0)
    setFeedbackCategory('')
    setFeedbackMessage('')
    setFeedbackSubmitted(false)
  }

  // Helper to get category icon
  const getCategoryIcon = (category) => {
    switch (category) {
      case 'gaming': return <Zap className="w-5 h-5" />;
      case 'workstation': return <Award className="w-5 h-5" />;
      case 'cooling': return <Shield className="w-5 h-5" />;
      default: return <Cpu className="w-5 h-5" />;
    }
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Hero Slideshow */}
      <HeroSlideshow setCurrentPage={setCurrentPage} />

      {/* Why Choose Us */}
      <section className="py-12 lg:py-20 bg-white px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Why Choose SIMS?</h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
              We make PC building simple, reliable, and enjoyable. 
              Our platform ensures you get the perfect build every time.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 lg:gap-8">
            {features.map((feature, index) => (
              <div key={index} className="text-center p-4 lg:p-6 rounded-lg hover:bg-gray-50 transition-colors">
                <div className="w-12 h-12 lg:w-16 lg:h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4 text-green-600">
                  {feature.icon}
                </div>
                <h3 className="text-lg lg:text-xl font-semibold text-gray-900 mb-2">{feature.title}</h3>
                <p className="text-gray-600 text-sm lg:text-base">{feature.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Prebuilt PCs */}
      <section className="py-12 lg:py-20 bg-gray-50 px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-12 lg:mb-16">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Prebuilt PC Recommendations</h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
              Not sure where to start? Check out our expertly curated prebuilt configurations 
              for different use cases and budgets.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loadingPrebuilts ? (
              <div className="text-center py-12">
                <p>Loading prebuilt PC recommendations...</p>
              </div>
            ) : prebuiltPCs.length === 0 ? (
              <div className="text-center py-12">
                <p>No prebuilt PC recommendations found. Please check back later or try a different search.</p>
              </div>
            ) : (
              prebuiltPCs.map((pc) => (
                <div
                  key={pc.id}
                  onClick={() => handlePrebuiltSelect(pc)}
                  className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden hover:shadow-lg transition-all duration-300 cursor-pointer transform hover:scale-105 hover:border-green-300"
                >

                  {/* Content */}
                  <div className="p-6">
                                      {/* Header */}
                  <div className="mb-4">
                    <h3 className="text-xl font-bold text-gray-900 mb-2">{pc.name}</h3>
                    <div className="flex items-center gap-2 text-sm text-gray-600">
                      {getCategoryIcon(pc.category)}
                      <span className="capitalize">{pc.category}</span>
                    </div>
                  </div>
                  {/* Price */}
                  <div className="mb-4">
                    <div className="flex items-center gap-2">
                      <span className="text-3xl font-bold text-green-600">
                        ₱{parseFloat(pc.price).toLocaleString()}
                      </span>
                    </div>
                  </div>
                  {/* Description */}
                  {pc.description && (
                    <div className="mb-4">
                      <p className="text-sm text-gray-600">{pc.description}</p>
                    </div>
                  )}
                  {/* Performance Bars - if available */}
                  {(() => {
                    let performance = null;
                    if (pc.performance) {
                      if (typeof pc.performance === 'string') {
                        try {
                          performance = JSON.parse(pc.performance);
                        } catch (e) {
                          performance = null;
                        }
                      } else {
                        performance = pc.performance;
                      }
                    }
                    
                    if (performance) {
                      return (
                        <div className="mb-4 space-y-2">
                          {performance.gaming && (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Gaming</span>
                                <span className="font-medium">{performance.gaming}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-blue-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${performance.gaming}%` }}
                                ></div>
                              </div>
                            </>
                          )}
                          {performance.streaming && (
                            <>
                              <div className="flex items-center justify-between text-sm">
                                <span className="text-gray-600">Streaming</span>
                                <span className="font-medium">{performance.streaming}%</span>
                              </div>
                              <div className="w-full bg-gray-200 rounded-full h-2">
                                <div
                                  className="bg-purple-600 h-2 rounded-full transition-all duration-500"
                                  style={{ width: `${performance.streaming}%` }}
                                ></div>
                              </div>
                            </>
                          )}
                        </div>
                      );
                    }
                    return null;
                  })()}
                  {/* Features - if available */}
                  {(() => {
                    let features = null;
                    if (pc.features) {
                      if (typeof pc.features === 'string') {
                        try {
                          features = JSON.parse(pc.features);
                        } catch (e) {
                          features = null;
                        }
                      } else {
                        features = pc.features;
                      }
                    }
                    
                    if (features && features.length > 0) {
                      return (
                        <div className="mb-6">
                          <div className="flex flex-wrap gap-1">
                            {features.slice(0, 3).map((feature, index) => (
                              <span key={index} className="bg-green-100 text-green-800 px-2 py-1 rounded-full text-xs">
                                {feature}
                              </span>
                            ))}
                          </div>
                        </div>
                      );
                    }
                    return null;
                  })()}
                    {/* Click to view hint */}
                    <div className="mb-4 text-center">
                      <p className="text-sm text-gray-500 italic">Click to view in PC Assembly</p>
                    </div>
                    {/* View Details Button */}
                    <button
                      onClick={e => {
                        e.stopPropagation();
                        handlePrebuiltSelect(pc);
                      }}
                      className="w-full bg-green-600 text-white py-2 px-4 rounded-lg font-medium hover:bg-green-700 transition-colors flex items-center justify-center gap-2"
                    >
                      <ArrowRight className="w-4 h-4" />
                      View Details
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section className="py-12 lg:py-20 bg-white px-4 lg:px-8">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 lg:gap-16 items-center">
            <div>
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4 lg:mb-6">
                Advanced Compatibility Checking
              </h2>
              <p className="text-lg lg:text-xl text-gray-600 mb-6 lg:mb-8">
                Our intelligent system checks compatibility between all components in real-time, 
                ensuring your build will work perfectly together.
              </p>
              <div className="space-y-3 lg:space-y-4">
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                  <span className="text-base lg:text-lg text-gray-700">CPU and motherboard socket compatibility</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                  <span className="text-base lg:text-lg text-gray-700">RAM type and speed validation</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                  <span className="text-base lg:text-lg text-gray-700">Power supply wattage requirements</span>
                </div>
                <div className="flex items-center gap-3">
                  <CheckCircle className="w-5 h-5 lg:w-6 lg:h-6 text-green-600" />
                  <span className="text-base lg:text-lg text-gray-700">Case and motherboard form factor matching</span>
                </div>
              </div>
            </div>
            <div className="bg-gray-100 rounded-lg p-6 lg:p-8">
              <div className="space-y-4">
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Compatibility Score</span>
                    <span className="text-green-600 font-bold">100%</span>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Total Price</span>
                    <span className="text-green-600 font-bold">₱45,999</span>
                  </div>
                </div>
                <div className="bg-white p-4 rounded-lg shadow-sm">
                  <div className="flex items-center justify-between">
                    <span className="font-medium">Build Status</span>
                    <span className="text-green-600 font-bold">Ready</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* FAQ Section */}
      <section className="py-12 lg:py-20 bg-gray-50 px-4 lg:px-8">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12 lg:mb-16">
            <div className="flex items-center justify-center gap-3 mb-4">
              <HelpCircle className="w-8 h-8 text-green-600" />
              <h2 className="text-3xl lg:text-4xl font-bold text-gray-900">Frequently Asked Questions</h2>
            </div>
            <p className="text-lg lg:text-xl text-gray-600 max-w-3xl mx-auto">
              Got questions about SIMS? We've got answers. 
              Find everything you need to know about our platform and PC building.
            </p>
          </div>

          <div className="space-y-4">
            {faqData.map((faq) => (
              <div key={faq.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
                <button
                  onClick={() => toggleFaq(faq.id)}
                  className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
                >
                  <span className="text-lg font-medium text-gray-900">{faq.question}</span>
                  {openFaq === faq.id ? (
                    <ChevronUp className="w-5 h-5 text-gray-500" />
                  ) : (
                    <ChevronDown className="w-5 h-5 text-gray-500" />
                  )}
                </button>
                {openFaq === faq.id && (
                  <div className="px-6 pb-4">
                    <p className="text-gray-600 leading-relaxed">{faq.answer}</p>
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Feedback Section */}
      <section className="py-12 lg:py-20 bg-white px-4 lg:px-8">
        <div className="max-w-4xl mx-auto text-center">
          <div className="mb-8">
            <h2 className="text-3xl lg:text-4xl font-bold text-gray-900 mb-4">Help Us Improve</h2>
            <p className="text-lg lg:text-xl text-gray-600 max-w-2xl mx-auto">
              Your feedback helps us make SIMS better for everyone. 
              Share your thoughts, report issues, or suggest new features.
            </p>
          </div>
          <button
            onClick={() => setShowFeedbackModal(true)}
            className="bg-green-600 text-white px-8 py-4 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors flex items-center gap-3 mx-auto"
          >
            <MessageSquare className="w-6 h-6" />
            Give Feedback
          </button>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-12 lg:py-20 bg-green-600 text-white px-4 lg:px-8">
        <div className="max-w-7xl mx-auto text-center">
          <h2 className="text-3xl lg:text-4xl font-bold mb-4 lg:mb-6">Ready to Build Your Dream PC?</h2>
          <p className="text-lg lg:text-xl mb-6 lg:mb-8 max-w-2xl mx-auto">
            Join thousands of users who have successfully built their perfect PC 
            using our platform. Start your build today!
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <button 
              onClick={() => setCurrentPage('pc-assembly')}
              className="bg-white text-green-600 px-6 lg:px-8 py-3 lg:py-4 rounded-lg font-semibold text-base lg:text-lg hover:bg-gray-100 transition-colors flex items-center gap-3"
            >
              Get Started Now
              <ArrowRight className="w-5 h-5" />
            </button>
          </div>
        </div>
      </section>

      {/* Feedback Modal */}
      {showFeedbackModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="p-6 lg:p-8">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-2xl lg:text-3xl font-bold text-gray-900">Share Your Feedback</h3>
                <button
                  onClick={() => {
                    setShowFeedbackModal(false)
                    resetFeedbackForm()
                  }}
                  className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
                >
                  <X className="w-6 h-6 text-gray-500" />
                </button>
              </div>

              {!feedbackSubmitted ? (
                <form onSubmit={handleFeedbackSubmit} className="space-y-6">
                  {/* Rating */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      How would you rate your experience with SIMS?
                    </label>
                    <div className="flex justify-center gap-2">
                      {[1, 2, 3, 4, 5].map((rating) => (
                        <button
                          key={rating}
                          type="button"
                          onClick={() => setFeedbackRating(rating)}
                          className={`p-2 rounded-lg transition-colors ${
                            feedbackRating >= rating 
                              ? 'text-yellow-400 bg-yellow-50' 
                              : 'text-gray-300 hover:text-yellow-400'
                          }`}
                        >
                          <Star className={`w-8 h-8 ${feedbackRating >= rating ? 'fill-current' : ''}`} />
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Category */}
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-3">
                      What type of feedback is this?
                    </label>
                    <div className="grid grid-cols-2 lg:grid-cols-3 gap-3">
                      {feedbackCategories.map((category) => (
                        <button
                          key={category.id}
                          type="button"
                          onClick={() => setFeedbackCategory(category.id)}
                          className={`p-3 rounded-lg border-2 transition-colors flex items-center gap-2 text-sm ${
                            feedbackCategory === category.id
                              ? `border-current ${category.color}`
                              : 'border-gray-200 hover:border-gray-300 text-gray-700'
                          }`}
                        >
                          {category.name}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Message */}
                  <div>
                    <label htmlFor="feedback-message" className="block text-sm font-medium text-gray-700 mb-3">
                      Tell us more about your experience
                    </label>
                    <textarea
                      id="feedback-message"
                      value={feedbackMessage}
                      onChange={(e) => setFeedbackMessage(e.target.value)}
                      placeholder="Share your thoughts, suggestions, or report any issues you encountered..."
                      className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent resize-none"
                      rows="4"
                      required
                    />
                  </div>

                  {/* Submit Button */}
                  <div className="flex flex-col sm:flex-row gap-4 justify-center">
                    <button
                      type="submit"
                      disabled={!feedbackRating || !feedbackCategory || !feedbackMessage.trim()}
                      className="bg-green-600 text-white px-6 lg:px-8 py-3 lg:py-4 rounded-lg font-semibold hover:bg-green-700 transition-colors disabled:bg-gray-300 disabled:cursor-not-allowed flex items-center gap-3 justify-center"
                    >
                      <Send className="w-5 h-5" />
                      Submit Feedback
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowFeedbackModal(false)
                        resetFeedbackForm()
                      }}
                      className="border-2 border-gray-300 text-gray-700 px-6 lg:px-8 py-3 lg:py-4 rounded-lg font-semibold hover:bg-gray-50 transition-colors"
                    >
                      Cancel
                    </button>
                  </div>
                </form>
              ) : (
                <div className="text-center p-6 bg-green-50 rounded-lg border border-green-200">
                  <div className="flex items-center justify-center gap-3 mb-2">
                    <CheckCircle className="w-6 h-6 text-green-600" />
                    <h4 className="text-lg font-semibold text-green-800">Thank You!</h4>
                  </div>
                  <p className="text-green-700">
                    Your feedback has been submitted successfully. We appreciate your input and will use it to improve SIMS!
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-900 text-white">
        {/* Main Footer Content */}
        <div className="max-w-7xl mx-auto px-4 lg:px-8 py-12 lg:py-16">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-8 lg:gap-12">
            {/* Company Info */}
            <div className="lg:col-span-1">
              <div className="mb-6">
                <h3 className="text-2xl lg:text-3xl font-bold text-green-400 mb-2">SIMS</h3>
                <p className="text-gray-300 text-sm lg:text-base leading-relaxed">
                  The ultimate platform for building your perfect PC. Check compatibility, 
                  compare prices, and create your dream build with confidence.
                </p>
              </div>
            </div>

            {/* Quick Links */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Quick Links</h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => setCurrentPage('pc-assembly')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    PC Assembly
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setCurrentPage('prebuilt-pcs')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Prebuilt PCs
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setCurrentPage('about')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    About Us
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setCurrentPage('contact')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Contact
                  </button>
                </li>
              </ul>
            </div>

            {/* Support */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Support</h4>
              <ul className="space-y-2">
                <li>
                  <button 
                    onClick={() => setCurrentPage('faq')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    FAQ
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setCurrentPage('compatibility-guide')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Compatibility Guide
                  </button>
                </li>
                <li>
                  <button 
                    onClick={() => setCurrentPage('troubleshooting')}
                    className="text-gray-300 hover:text-white transition-colors"
                  >
                    Troubleshooting
                  </button>
                </li>
              </ul>
            </div>

            {/* Contact Info */}
            <div>
              <h4 className="text-lg font-semibold mb-4">Contact Info</h4>
              <div className="space-y-2 text-gray-300">
                <p>Email: support@builditpc.com</p>
                <p>Phone: +63 912 345 6789</p>
                <p>Address: Manila, Philippines</p>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Footer */}
        <div className="border-t border-gray-800">
          <div className="max-w-7xl mx-auto px-4 lg:px-8 py-6">
            <div className="flex flex-col md:flex-row justify-between items-center">
              <p className="text-gray-400 text-sm">© 2025 SIMS. All rights reserved.</p>
              <div className="mt-4 md:mt-0" />
            </div>
          </div>
        </div>
      </footer>
    </div>
  )
}

export default Home