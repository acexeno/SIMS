import React, { useState } from 'react';
import { ArrowLeft, Search, AlertTriangle, CheckCircle, XCircle, Wrench, Lightbulb, BookOpen } from 'lucide-react';

const Troubleshooting = ({ setCurrentPage }) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  const categories = [
    { id: 'all', name: 'All Issues', icon: '🔧' },
    { id: 'compatibility', name: 'Compatibility', icon: '⚠️' },
    { id: 'performance', name: 'Performance', icon: '⚡' },
    { id: 'hardware', name: 'Hardware', icon: '💻' },
    { id: 'software', name: 'Software', icon: '💾' },
    { id: 'build', name: 'Build Process', icon: '🔨' }
  ];

  const troubleshootingIssues = [
    {
      id: 1,
      title: 'Components show as incompatible when they should work',
      category: 'compatibility',
      severity: 'high',
      symptoms: [
        'Compatibility checker shows red X for components that should work',
        'Components are from same generation but marked incompatible',
        'Socket types match but still showing as incompatible'
      ],
      solutions: [
        'Check if component specifications are complete in database',
        'Verify exact model numbers match manufacturer specifications',
                'Update component database with latest specifications',
        'Contact support if issue persists with specific components'
      ],
      prevention: [
        'Always double-check component specifications before purchasing',
        'Use official manufacturer websites for verification',
        'Keep component database updated with latest information'
      ]
    },
    {
      id: 2,
      title: 'PC Assembly page loads slowly or times out',
      category: 'performance',
      severity: 'medium',
      symptoms: [
        'Page takes more than 5 seconds to load',
        'Components list shows loading spinner indefinitely',
        'Browser shows timeout errors'
      ],
      solutions: [
        'Check internet connection stability',
        'Clear browser cache and cookies',
        'Try refreshing the page',
        'Disable browser extensions temporarily',
        'Try using a different browser'
      ],
      prevention: [
        'Use a stable internet connection',
        'Keep browser updated to latest version',
        'Clear browser cache regularly'
      ]
    },
    {
      id: 3,
      title: 'Selected components disappear after page refresh',
      category: 'software',
      severity: 'high',
      symptoms: [
        'Components selected in PC Assembly disappear on refresh',
        'Build progress resets to zero',
        'Selected components not saved'
      ],
      solutions: [
        'Ensure you are logged in to your account',
        'Check if browser has JavaScript enabled',
        'Try saving your build before refreshing',
        'Clear browser cache and try again'
      ],
      prevention: [
        'Always log in before starting a build',
        'Save your build periodically during selection',
        'Use a supported browser with JavaScript enabled'
      ]
    },
    {
      id: 4,
      title: 'Chat support not working or messages not sending',
      category: 'software',
      severity: 'medium',
      symptoms: [
        'Chat window opens but messages don\'t send',
        'Floating chat button not visible',
        'Messages appear to send but don\'t reach support'
      ],
      solutions: [
        'Check internet connection',
        'Refresh the page and try again',
        'Clear browser cache',
        'Try using incognito/private browsing mode',
        'Contact support through alternative methods'
      ],
      prevention: [
        'Use a stable internet connection',
        'Keep browser updated',
        'Avoid using multiple chat sessions simultaneously'
      ]
    },
    {
      id: 5,
      title: 'Cannot access admin dashboard or features',
      category: 'software',
      severity: 'high',
      symptoms: [
        'Admin login works but dashboard doesn\'t load',
        'Admin features show access denied errors',
        'Cannot see admin sidebar or navigation'
      ],
      solutions: [
        'Verify admin account has correct permissions',
        'Check if account role is properly set in database',
        'Log out and log back in',
        'Contact system administrator',
        'Check browser console for error messages'
      ],
      prevention: [
        'Ensure admin accounts are properly configured',
        'Regularly verify user permissions',
        'Keep user roles updated in database'
      ]
    },
    {
      id: 6,
      title: 'Component images not loading or showing placeholders',
      category: 'hardware',
      severity: 'low',
      symptoms: [
        'Component cards show placeholder images',
        'Images load slowly or not at all',
        'Broken image icons appear'
      ],
      solutions: [
        'Check internet connection speed',
        'Refresh the page',
        'Clear browser cache',
        'Try loading images in a new tab',
        'Contact support if issue persists'
      ],
      prevention: [
        'Use a stable internet connection',
        'Keep browser updated',
        'Avoid ad blockers that might block images'
      ]
    },
    {
      id: 7,
      title: 'Build compatibility score shows incorrect percentage',
      category: 'compatibility',
      severity: 'medium',
      symptoms: [
        'Compatibility score doesn\'t match actual compatibility',
        'Score shows 0% when components should be compatible',
        'Score doesn\'t update when components change'
      ],
      solutions: [
        'Refresh the page to recalculate compatibility',
        'Remove and re-add components',
        'Check if all required components are selected',
        'Verify component specifications are complete',
        'Contact support with specific component details'
      ],
      prevention: [
        'Ensure all component data is accurate and complete',
        'Regularly update compatibility checking algorithms',
        'Test compatibility calculations with known good builds'
      ]
    },
    {
      id: 8,
      title: 'Cannot save or submit PC build',
      category: 'build',
      severity: 'high',
      symptoms: [
        'Save button doesn\'t work or is disabled',
        'Build submission fails with error message',
        'Build appears to save but doesn\'t persist'
      ],
      solutions: [
        'Ensure you are logged in to your account',
        'Check if all required fields are filled',
        'Verify internet connection is stable',
        'Try saving with a different build name',
        'Check browser console for error messages',
        'Contact support if issue persists'
      ],
      prevention: [
        'Always log in before starting a build',
        'Fill in all required information',
        'Use a stable internet connection',
        'Save builds regularly during the process'
      ]
    }
  ];

  const filteredIssues = troubleshootingIssues.filter(issue => {
    const matchesSearch = issue.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         issue.symptoms.some(symptom => symptom.toLowerCase().includes(searchTerm.toLowerCase())) ||
                         issue.solutions.some(solution => solution.toLowerCase().includes(searchTerm.toLowerCase()));
    const matchesCategory = selectedCategory === 'all' || issue.category === selectedCategory;
    return matchesSearch && matchesCategory;
  });

  const getSeverityColor = (severity) => {
    switch (severity) {
      case 'high': return 'text-red-600 bg-red-100';
      case 'medium': return 'text-yellow-600 bg-yellow-100';
      case 'low': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getSeverityIcon = (severity) => {
    switch (severity) {
      case 'high': return <XCircle className="w-4 h-4" />;
      case 'medium': return <AlertTriangle className="w-4 h-4" />;
      case 'low': return <CheckCircle className="w-4 h-4" />;
      default: return <AlertTriangle className="w-4 h-4" />;
    }
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
            <h1 className="text-2xl font-bold text-gray-900">Troubleshooting</h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Header Section */}
        <div className="text-center mb-12">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Wrench className="w-8 h-8 text-green-600" />
            <h2 className="text-4xl font-bold text-gray-900">Troubleshooting Guide</h2>
          </div>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            Having issues with SIMS? Find solutions to common problems and get back to building your perfect PC.
          </p>
        </div>

        {/* Search and Filter */}
        <div className="mb-8 space-y-4">
          {/* Search Bar */}
          <div className="relative max-w-2xl mx-auto">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search troubleshooting issues..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-green-500 focus:border-transparent"
            />
          </div>

          {/* Category Filter */}
          <div className="flex flex-wrap justify-center gap-2">
            {categories.map((category) => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category.id)}
                className={`px-4 py-2 rounded-lg font-medium transition-colors ${
                  selectedCategory === category.id
                    ? 'bg-green-600 text-white'
                    : 'bg-white text-gray-700 border border-gray-300 hover:bg-gray-50'
                }`}
              >
                <span className="mr-2">{category.icon}</span>
                {category.name}
              </button>
            ))}
          </div>
        </div>

        {/* Issues List */}
        <div className="space-y-6">
          {filteredIssues.map((issue) => (
            <div key={issue.id} className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
              <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                  <h3 className="text-xl font-semibold text-gray-900 mb-2">{issue.title}</h3>
                  <div className="flex items-center gap-3">
                    <span className={`px-2 py-1 rounded-full text-xs font-medium flex items-center gap-1 ${getSeverityColor(issue.severity)}`}>
                      {getSeverityIcon(issue.severity)}
                      {issue.severity.charAt(0).toUpperCase() + issue.severity.slice(1)} Priority
                    </span>
                    <span className="text-sm text-gray-500 capitalize">{issue.category}</span>
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {/* Symptoms */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-red-500" />
                    Symptoms
                  </h4>
                  <ul className="space-y-2">
                    {issue.symptoms.map((symptom, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-red-500 mt-1">•</span>
                        {symptom}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Solutions */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Wrench className="w-4 h-4 text-green-500" />
                    Solutions
                  </h4>
                  <ul className="space-y-2">
                    {issue.solutions.map((solution, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-green-500 mt-1">•</span>
                        {solution}
                      </li>
                    ))}
                  </ul>
                </div>

                {/* Prevention */}
                <div>
                  <h4 className="font-semibold text-gray-900 mb-3 flex items-center gap-2">
                    <Lightbulb className="w-4 h-4 text-blue-500" />
                    Prevention
                  </h4>
                  <ul className="space-y-2">
                    {issue.prevention.map((tip, index) => (
                      <li key={index} className="text-sm text-gray-600 flex items-start gap-2">
                        <span className="text-blue-500 mt-1">•</span>
                        {tip}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* No Results */}
        {filteredIssues.length === 0 && (
          <div className="text-center py-12">
            <BookOpen className="w-16 h-16 text-gray-400 mx-auto mb-4" />
            <h3 className="text-lg font-medium text-gray-900 mb-2">No issues found</h3>
            <p className="text-gray-600 mb-4">Try adjusting your search terms or browse all categories.</p>
            <button
              onClick={() => {
                setSearchTerm('');
                setSelectedCategory('all');
              }}
              className="text-green-600 hover:text-green-700 font-medium"
            >
              Clear filters
            </button>
          </div>
        )}

        {/* Contact Support CTA */}
        <div className="mt-12 text-center">
          <div className="bg-green-50 rounded-lg p-8">
            <h3 className="text-2xl font-semibold text-gray-900 mb-4">Still need help?</h3>
            <p className="text-gray-600 mb-6">
              Can't find a solution to your problem? Our support team is ready to help you get back on track.
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

export default Troubleshooting;
