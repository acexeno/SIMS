import React, { useState } from 'react';
import { ArrowLeft, ChevronDown, ChevronUp, HelpCircle, Search } from 'lucide-react';

const FAQ = ({ setCurrentPage }) => {
  const [openFaq, setOpenFaq] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  const faqData = [
    {
      id: 1,
      question: "How does SIMS's compatibility checker work?",
      answer: "Our advanced compatibility checker uses a sophisticated algorithm that analyzes multiple aspects of your selected components in real-time. It checks CPU socket compatibility with motherboards (ensuring AM5 CPUs work with AM5 motherboards, LGA1700 with LGA1700, etc.), validates RAM type matching (DDR4 vs DDR5), calculates power supply wattage requirements based on component TDP ratings, and verifies case form factor compatibility. The system also considers physical dimensions, cooling requirements, and expansion slot availability. When you select components, the checker immediately updates the compatibility score and provides specific feedback on any issues, helping you make informed decisions before purchasing.",
      category: "Compatibility"
    },
    {
      id: 2,
      question: "Can I save my PC build for later?",
      answer: "Currently, SIMS operates as a real-time building and compatibility checking platform. While we don't have a persistent save feature yet, you can easily recreate your build by selecting the same components from our comprehensive database. We're actively developing build saving, sharing, and export features that will allow you to save multiple builds, share them with friends, export parts lists to retailers, and even receive notifications when component prices change. These features will be available in upcoming updates, making it easier to plan and compare different build configurations over time.",
      category: "Features"
    },
    {
      id: 3,
      question: "Are the component prices on SIMS accurate?",
      answer: "The prices shown on SIMS are carefully researched market prices in Philippine Peso (₱) based on current retail data from major Philippine retailers and online marketplaces. However, actual prices may vary due to factors like regional availability, seasonal fluctuations, import duties, and retailer-specific promotions. We recommend using our prices as a baseline for budgeting and comparison, then checking with local retailers like PCHub, DynaQuest, EasyPC, or online platforms like Lazada and Shopee for the most current pricing. Our price estimates are updated regularly to reflect market trends and new product releases.",
      category: "Pricing"
    },
    {
      id: 4,
      question: "How often is the component database updated?",
      answer: "Our component database is continuously updated through multiple channels. We add new CPU and GPU releases within 24-48 hours of their official announcement, update motherboard specifications as manufacturers release new models, and refresh pricing data weekly. Our team monitors major tech announcements, manufacturer websites, and retailer catalogs to ensure comprehensive coverage. We also update component specifications, compatibility rules, and performance benchmarks based on the latest reviews and testing data. This ensures you always have access to the most current information when making your build decisions, including the latest Intel 14th gen, AMD Ryzen 7000 series, and NVIDIA RTX 4000 series components.",
      category: "Database"
    },
    {
      id: 5,
      question: "What if the compatibility checker shows issues with my build?",
      answer: "When compatibility issues are detected, our system provides detailed analysis and actionable solutions. For CPU-motherboard mismatches, we'll suggest compatible alternatives or explain the socket requirements. RAM compatibility issues include recommendations for the correct DDR4/DDR5 modules and supported speeds. Power supply warnings show your estimated power draw and suggest appropriate wattage ratings. Case compatibility issues detail form factor requirements and suggest suitable alternatives. The system also provides performance impact assessments, helping you understand how different component choices affect your build's capabilities. You can use our 'Find Compatible' feature to automatically suggest alternatives that resolve the conflicts while maintaining your performance goals.",
      category: "Troubleshooting"
    },
    {
      id: 6,
      question: "Can I use SIMS on mobile devices?",
      answer: "SIMS is fully responsive and optimized for all devices, including smartphones and tablets. The interface automatically adapts to your screen size, with touch-friendly buttons, swipe gestures for component browsing, and optimized layouts for smaller screens. While the desktop experience offers the most comprehensive view with side-by-side component comparison and detailed specifications, the mobile version provides full functionality for building and checking compatibility. You can browse components, check compatibility, view prebuilt recommendations, and access the FAQ section seamlessly on any device. The mobile interface prioritizes essential features while maintaining the same accuracy and reliability as the desktop version.",
      category: "Mobile"
    },
    {
      id: 7,
      question: "How accurate are the prebuilt PC recommendations?",
      answer: "Our prebuilt PC recommendations are meticulously curated by a team of PC building experts who analyze market trends, performance benchmarks, and user requirements. Each system is tested for compatibility, performance, and value-for-money across different use cases. Gaming builds are optimized for frame rates and graphics performance, streaming builds balance CPU and GPU requirements for content creation, and workstation builds prioritize multi-core performance and reliability. We regularly update these recommendations based on new component releases, price changes, and performance improvements. Each prebuilt includes detailed specifications, estimated performance metrics, and upgrade paths, helping you understand exactly what you're getting and how it can be improved over time.",
      category: "Prebuilts"
    },
    {
      id: 8,
      question: "Does SIMS provide assembly instructions?",
      answer: "While SIMS primarily focuses on component selection and compatibility checking, we provide comprehensive guidance throughout the PC building process. Our platform includes general assembly tips, component installation order recommendations, and common troubleshooting advice. For detailed step-by-step assembly instructions, we recommend consulting the manufacturer manuals that come with each component, as they contain specific installation procedures and safety guidelines. We also provide links to trusted assembly guides and video tutorials from reputable sources. For users who prefer professional assembly, we can recommend local PC building services and provide guidance on what to look for when choosing an assembler. Our goal is to make the entire PC building journey as smooth as possible, from planning to completion.",
      category: "Assembly"
    },
    {
      id: 9,
      question: "Can I compare different component options side by side?",
      answer: "Yes! SIMS offers comprehensive component comparison features. You can preview individual components to see detailed specifications, performance benchmarks, and user reviews. The compatibility checker helps you understand how different component combinations work together, showing the impact of each choice on your overall build performance and compatibility. You can compare multiple CPUs, GPUs, or other components side-by-side to see differences in specifications, power consumption, and performance metrics. The system also provides performance estimates for different combinations, helping you make informed decisions based on your specific needs and budget. Whether you're choosing between AMD and Intel processors, different GPU tiers, or various storage options, our comparison tools help you understand the trade-offs and make the best choice for your build.",
      category: "Comparison"
    },
    {
      id: 10,
      question: "Is SIMS free to use?",
      answer: "Yes, SIMS is completely free to use! All our core features are available at no cost, including the advanced compatibility checker, comprehensive component database, prebuilt PC recommendations, and all platform tools. We believe that PC building should be accessible to everyone, regardless of budget constraints. Our business model is supported through partnerships with retailers and manufacturers, allowing us to provide accurate pricing and product information while keeping the platform free for users. We're committed to maintaining this free access while continuously improving our features and expanding our component database. There are no hidden fees, premium tiers, or paid features - everything you need to build your perfect PC is available completely free of charge.",
      category: "Pricing"
    }
  ];

  const categories = ["All", "Compatibility", "Features", "Pricing", "Database", "Troubleshooting", "Mobile", "Prebuilts", "Assembly", "Comparison"];

  const filteredFaqs = faqData.filter(faq => {
    const matchesSearch = faq.question.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         faq.answer.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesSearch;
  });

  const toggleFaq = (id) => {
    setOpenFaq(openFaq === id ? null : id);
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
            <h1 className="text-2xl font-bold text-gray-900">FAQ</h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <HelpCircle className="w-8 h-8 text-green-600" />
            <h2 className="text-4xl font-bold text-gray-900">Frequently Asked Questions</h2>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Find answers to common questions about SIMS and PC building. 
            Can't find what you're looking for? Contact us for personalized help.
          </p>
        </div>

        {/* Search Bar */}
        <div className="mb-8">
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search FAQ..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>
        </div>

        {/* FAQ Items */}
        <div className="space-y-4">
          {filteredFaqs.map((faq) => (
            <div key={faq.id} className="bg-white rounded-lg shadow-sm border border-gray-200">
              <button
                onClick={() => toggleFaq(faq.id)}
                className="w-full px-6 py-4 text-left flex items-center justify-between hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-lg font-medium text-gray-900">{faq.question}</span>
                  <span className="text-xs bg-green-100 text-green-700 px-2 py-1 rounded-full">
                    {faq.category}
                  </span>
                </div>
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

        {/* No Results */}
        {filteredFaqs.length === 0 && (
          <div className="text-center py-12">
            <HelpCircle className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No FAQs found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search terms or browse all FAQs.</p>
            <button
              onClick={() => setSearchTerm('')}
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Clear search
            </button>
          </div>
        )}

        {/* Contact CTA */}
        <div className="mt-12 text-center">
          <div className="bg-green-50 rounded-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Still have questions?</h3>
            <p className="text-gray-600 mb-6">
              Can't find the answer you're looking for? Our support team is here to help.
            </p>
            <div className="flex flex-col sm:flex-row gap-4 justify-center">
              <button
                onClick={() => setCurrentPage('contact')}
                className="bg-green-600 text-white px-6 py-3 rounded-lg font-semibold hover:bg-green-700 transition-colors"
              >
                Contact Support
              </button>
              <button
                onClick={() => setCurrentPage('chat-support')}
                className="border-2 border-green-600 text-green-600 px-6 py-3 rounded-lg font-semibold hover:bg-green-50 transition-colors"
              >
                Live Chat
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default FAQ;
