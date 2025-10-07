import React from 'react';
import { ArrowLeft, Users, Award, Target, Heart } from 'lucide-react';

const About = ({ setCurrentPage }) => {
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
            <h1 className="text-2xl font-bold text-gray-900">About SIMS</h1>
            <div></div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        {/* Hero Section */}
        <div className="text-center mb-16">
          <h2 className="text-4xl font-bold text-gray-900 mb-6">About SIMS</h2>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto">
            SIMS (Smart Inventory Management System) is a comprehensive PC building platform 
            designed to make computer assembly accessible, reliable, and enjoyable for everyone.
          </p>
        </div>

        {/* Mission & Vision */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mb-16">
          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <Target className="w-8 h-8 text-green-600" />
              <h3 className="text-2xl font-semibold text-gray-900">Our Mission</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              To democratize PC building by providing an intuitive platform that eliminates 
              compatibility concerns and makes custom computer assembly accessible to users 
              of all technical skill levels.
            </p>
          </div>

          <div className="bg-white rounded-lg shadow-sm p-8">
            <div className="flex items-center gap-3 mb-4">
              <Award className="w-8 h-8 text-green-600" />
              <h3 className="text-2xl font-semibold text-gray-900">Our Vision</h3>
            </div>
            <p className="text-gray-600 leading-relaxed">
              To become the leading platform for PC building education and component 
              compatibility, empowering users to build their dream computers with confidence.
            </p>
          </div>
        </div>

        {/* Features */}
        <div className="mb-16">
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-12">What Makes SIMS Special</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Users className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">User-Friendly</h4>
              <p className="text-gray-600">
                Intuitive interface designed for both beginners and experts
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Award className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Reliable</h4>
              <p className="text-gray-600">
                Advanced compatibility checking ensures your build will work
              </p>
            </div>

            <div className="text-center">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <Heart className="w-8 h-8 text-green-600" />
              </div>
              <h4 className="text-xl font-semibold text-gray-900 mb-3">Community-Driven</h4>
              <p className="text-gray-600">
                Built by PC enthusiasts, for PC enthusiasts
              </p>
            </div>
          </div>
        </div>

        {/* Team Section */}
        <div className="bg-white rounded-lg shadow-sm p-8">
          <h3 className="text-3xl font-bold text-gray-900 text-center mb-8">Our Team</h3>
          <p className="text-gray-600 text-center max-w-2xl mx-auto">
            SIMS is developed by a passionate team of computer science students and PC building 
            enthusiasts who understand the challenges of building custom computers. We're committed 
            to making PC building accessible and enjoyable for everyone.
          </p>
        </div>

        {/* CTA */}
        <div className="text-center mt-12">
          <button
            onClick={() => setCurrentPage('pc-assembly')}
            className="bg-green-600 text-white px-8 py-3 rounded-lg font-semibold text-lg hover:bg-green-700 transition-colors"
          >
            Start Building Your PC
          </button>
        </div>
      </div>
    </div>
  );
};

export default About;
