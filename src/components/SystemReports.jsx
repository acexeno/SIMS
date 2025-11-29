import React, { useState } from 'react';
import { formatCurrencyPHP } from '../utils/currency';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, PieChart as PieIcon, Package, Award, Layers, AlertTriangle, BarChart3, Eye, EyeOff, Download, Maximize2, X } from 'lucide-react';
import { downloadSalesReport } from '../utils/exportUtils';

// Improved color palette with better distinction between colors
const COLORS = ['#6366F1', '#10B981', '#F59E0B', '#EF4444', '#8B5CF6', '#06B6D4', '#EC4899', '#F97316', '#84CC16', '#14B8A6'];

const SystemReports = ({ reports = {}, inventory = [], categories = [], formalCategoryNames = {}, deadstockPeriod = 90, onDeadstockPeriodChange, isLoading }) => {
  if (isLoading) { // Use a dedicated isLoading prop instead
    return (
      <div className="flex flex-col items-center justify-center min-h-[300px] py-12">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-500 mb-4"></div>
        <div className="text-gray-500 text-lg">Loading Sales Reports...</div>
      </div>
    );
  }
  const {
    monthly_sales = [],
    daily_sales = [],
    weekly_sales = [],
    top_selling_products = [],
    revenue_per_category = [],
    revenue_per_brand = [],
    deadstock = [],
    stock_movement = [],
    order_status_breakdown = [],
    average_order_value = {}
  } = reports;
  const [deadstockCategory, setDeadstockCategory] = useState('all');
  const [salesChartType, setSalesChartType] = useState('monthly');
  const [showDeadstock, setShowDeadstock] = useState(true);
  const [deadstockSearchTerm, setDeadstockSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [expandedChart, setExpandedChart] = useState(null); // Track which chart is expanded
  const itemsPerPage = 10;
  const allowedCategoryNames = [
    'CPU', 'Motherboard', 'GPU', 'RAM', 'Storage', 'PSU', 'Case', 'Cooler',
    'Procie Only', 'Mobo', 'Ram 3200mhz', 'Ssd Nvme', 'Psu - Tr', 'Case Gaming', 'Aio'
  ];
  const componentCategories = (categories || []).filter(cat => allowedCategoryNames.includes(cat.name));
  // Use deadstock data directly without filtering by inventory
  const filteredDeadstockRaw = deadstock || [];
  // Get category IDs from deadstock items directly
  const deadstockCategoryIds = Array.from(new Set(
    filteredDeadstockRaw.map(item => {
      // Try to find category from inventory first, then from categories
      const inventoryItem = inventory.find(comp => comp.id === item.id);
      if (inventoryItem?.category_id) {
        return String(inventoryItem.category_id);
      }
      // If not in inventory, we'll need to get category from the deadstock item itself
      // For now, return null and we'll handle this in the display
      return null;
    }).filter(Boolean)
  ));
  const dropdownCategories = componentCategories.filter(cat => deadstockCategoryIds.includes(String(cat.id)));
  const filteredDeadstock = (deadstockCategory === 'all'
    ? filteredDeadstockRaw
    : filteredDeadstockRaw.filter(item => {
        const cat = inventory.find(comp => comp.id === item.id)?.category_id;
        return String(cat) === String(deadstockCategory);
      })
  ).filter(item => {
    // Filter by search term (name or brand)
    const search = deadstockSearchTerm.trim().toLowerCase();
    if (!search) return true;
    const name = item.name?.toLowerCase() || '';
    const brand = item.brand?.toLowerCase() || '';
    return name.includes(search) || brand.includes(search);
  });

  // Chart selection
  let salesChartData = [];
  let salesChartTitle = '';
  let salesChartComponent = null;
  if (salesChartType === 'monthly') {
    salesChartData = monthly_sales;
    salesChartTitle = 'Monthly Sales';
    salesChartComponent = (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={monthly_sales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottomRight', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="total_sales" stroke="#6366F1" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    );
  } else if (salesChartType === 'weekly') {
    salesChartData = weekly_sales;
    salesChartTitle = 'Weekly Sales';
    salesChartComponent = (
      <ResponsiveContainer width="100%" height={250}>
        <LineChart data={weekly_sales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottomRight', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Line type="monotone" dataKey="total_sales" stroke="#22D3EE" strokeWidth={3} />
        </LineChart>
      </ResponsiveContainer>
    );
  } else if (salesChartType === 'daily') {
    salesChartData = daily_sales;
    salesChartTitle = 'Daily Sales (Last 30 Days)';
    salesChartComponent = (
      <ResponsiveContainer width="100%" height={250}>
        <BarChart data={daily_sales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" />
          <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: 0 }} />
          <YAxis />
          <Tooltip />
          <Legend />
          <Bar dataKey="total_sales" fill="#F59E42" />
        </BarChart>
      </ResponsiveContainer>
    );
  }

  const handleDownloadReport = () => {
    downloadSalesReport(reports);
  };

  return (
    <div className="page-container space-y-8">
      <div className="flex items-center justify-between">
        <h2 className="page-title">Sales Reports & Analytics</h2>
        <button
          onClick={handleDownloadReport}
          className="btn btn-primary flex items-center gap-2"
          title="Download Sales Report as Excel"
        >
          <Download className="h-4 w-4" />
          Download Report
        </button>
      </div>
      {/* Friendly KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500">Average Order Value</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrencyPHP(average_order_value?.avg_order_value || 0)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Top Category</div>
          <div className="text-2xl font-bold text-gray-900">{(revenue_per_category?.[0]?.category) || '—'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Top Product</div>
          <div className="text-2xl font-bold text-gray-900">{(top_selling_products?.[0]?.name) || '—'}</div>
        </div>
      </div>
      <div className="space-y-6">

        {/* Sales Chart Card */}
        <div className="card chart-card relative">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-semibold text-gray-900">Sales Overview</h3>
            <div className="flex items-center gap-2">
              <label htmlFor="sales-chart-type" className="text-sm text-gray-600">View:</label>
              <select
                id="sales-chart-type"
                className="text-sm border-gray-300 rounded-md focus:ring-blue-500 focus:border-blue-500"
                value={salesChartType}
                onChange={e => setSalesChartType(e.target.value)}
              >
                <option value="monthly">Monthly</option>
                <option value="weekly">Weekly</option>
                <option value="daily">Daily</option>
              </select>
              {salesChartData && salesChartData.length > 0 && (
                <button
                  onClick={() => setExpandedChart('sales-overview')}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors ml-2"
                  title="Expand chart"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
          </div>
          <div className="h-[320px]">
            {salesChartData && salesChartData.length > 0 ? (
              salesChartComponent
            ) : (
              <div className="flex flex-col items-center justify-center h-full p-6">
                <Package className="w-12 h-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No data available</h3>
                <p className="text-gray-400 text-sm max-w-md text-center">
                  This could be because there are no completed orders yet or the system is still collecting data.
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Deadstock Toggle Button */}
        <div className="flex justify-end">
          <button
            className={`btn ${showDeadstock ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setShowDeadstock(v => !v)}
          >
            {showDeadstock ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            {showDeadstock ? 'Hide Deadstock' : 'Show Deadstock'}
          </button>
        </div>

        {/* Deadstock (conditionally rendered) */}
        {showDeadstock && (
          <div className="card">
            <div className="p-6 border-b border-gray-200">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <h3 className="text-lg font-semibold text-gray-900">Deadstock (No Sales in {deadstockPeriod} Days)</h3>
                <div className="flex gap-2">
                  <input
                    type="text"
                    className="border rounded px-3 py-1.5 text-sm w-full sm:w-64"
                    placeholder="Search by name or brand..."
                    value={deadstockSearchTerm}
                    onChange={e => setDeadstockSearchTerm(e.target.value)}
                  />
                  <select
                    className="border rounded px-3 py-1.5 text-sm"
                    value={deadstockCategory}
                    onChange={e => {
                      setDeadstockCategory(e.target.value);
                      setCurrentPage(1);
                    }}
                  >
                    <option value="all">All Categories</option>
                    {dropdownCategories.map(cat => (
                      <option key={cat.id} value={cat.id}>
                        {cat.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            </div>
            <div className="overflow-x-auto">
              {filteredDeadstock.length > 0 ? (
                <div>
                  <div className="min-w-full divide-y divide-gray-200">
                    <table className="min-w-full">
                      <thead className="bg-gray-50">
                        <tr>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Component
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Qty
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Price
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Total Value
                          </th>
                          <th className="px-6 py-3 text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                            Last Sold
                          </th>
                        </tr>
                      </thead>
                      <tbody className="bg-white divide-y divide-gray-200">
                        {filteredDeadstock
                          .slice((currentPage - 1) * itemsPerPage, currentPage * itemsPerPage)
                          .map(item => (
                            <tr key={item.id} className="hover:bg-gray-50">
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {item.name}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.stock_quantity}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {formatCurrencyPHP(item.price)}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                {formatCurrencyPHP(Number(item.price) * Number(item.stock_quantity))}
                              </td>
                              <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                {item.last_sold_date ? new Date(item.last_sold_date).toLocaleDateString() : 'Never'}
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                  {filteredDeadstock.length > itemsPerPage && (
                    <div className="flex items-center justify-between mt-4 px-4 py-3 bg-white border-t border-gray-200 sm:px-6">
                      <div className="flex-1 flex justify-between sm:hidden">
                        <button
                          onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                          disabled={currentPage === 1}
                          className={`relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                            currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Previous
                        </button>
                        <button
                          onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredDeadstock.length / itemsPerPage), p + 1))}
                          disabled={currentPage === Math.ceil(filteredDeadstock.length / itemsPerPage)}
                          className={`ml-3 relative inline-flex items-center px-4 py-2 border border-gray-300 text-sm font-medium rounded-md ${
                            currentPage === Math.ceil(filteredDeadstock.length / itemsPerPage) ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'
                          }`}
                        >
                          Next
                        </button>
                      </div>
                      <div className="hidden sm:flex-1 sm:flex sm:items-center sm:justify-between">
                        <div>
                          <p className="text-sm text-gray-700">
                            Showing <span className="font-medium">{(currentPage - 1) * itemsPerPage + 1}</span> to{' '}
                            <span className="font-medium">
                              {Math.min(currentPage * itemsPerPage, filteredDeadstock.length)}
                            </span>{' '}
                            of <span className="font-medium">{filteredDeadstock.length}</span> results
                          </p>
                        </div>
                        <div>
                          <nav className="relative z-0 inline-flex rounded-md shadow-sm -space-x-px" aria-label="Pagination">
                            <button
                              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
                              disabled={currentPage === 1}
                              className={`relative inline-flex items-center px-2 py-2 rounded-l-md border border-gray-300 bg-white text-sm font-medium ${
                                currentPage === 1 ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              <span className="sr-only">Previous</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M12.707 5.293a1 1 0 010 1.414L9.414 10l3.293 3.293a1 1 0 01-1.414 1.414l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                            {Array.from({ length: Math.ceil(filteredDeadstock.length / itemsPerPage) }, (_, i) => i + 1).map((page) => (
                              <button
                                key={page}
                                onClick={() => setCurrentPage(page)}
                                className={`relative inline-flex items-center px-4 py-2 border text-sm font-medium ${
                                  currentPage === page
                                    ? 'z-10 bg-indigo-50 border-indigo-500 text-indigo-600'
                                    : 'bg-white border-gray-300 text-gray-500 hover:bg-gray-50'
                                }`}
                              >
                                {page}
                              </button>
                            ))}
                            <button
                              onClick={() => setCurrentPage(p => Math.min(Math.ceil(filteredDeadstock.length / itemsPerPage), p + 1))}
                              disabled={currentPage === Math.ceil(filteredDeadstock.length / itemsPerPage)}
                              className={`relative inline-flex items-center px-2 py-2 rounded-r-md border border-gray-300 bg-white text-sm font-medium ${
                                currentPage === Math.ceil(filteredDeadstock.length / itemsPerPage) ? 'text-gray-300 cursor-not-allowed' : 'text-gray-500 hover:bg-gray-50'
                              }`}
                            >
                              <span className="sr-only">Next</span>
                              <svg className="h-5 w-5" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 20 20" fill="currentColor" aria-hidden="true">
                                <path fillRule="evenodd" d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z" clipRule="evenodd" />
                              </svg>
                            </button>
                          </nav>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-8 w-full">
                  <Package className="w-12 h-12 text-gray-300 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No deadstock data available</h3>
                  <div className="text-center w-full">
                    <p className="text-gray-400 text-sm max-w-md mx-auto text-center leading-relaxed" style={{textAlign: 'center', marginLeft: 'auto', marginRight: 'auto'}}>
                      This could be because there are no components with no sales in the specified period, or the system is still collecting data.
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top-Selling Products */}
          <div className="card chart-card relative">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Top-Selling Products</h3>
            <div className="flex items-center gap-2">
              <span className="text-xs text-gray-500">Qty vs Revenue</span>
              {top_selling_products && top_selling_products.length > 0 && (
                <button
                  onClick={() => setExpandedChart('top-selling')}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
          </div>
          <div className="h-[320px]">
              {top_selling_products && top_selling_products.length > 0 ? (
                <ResponsiveContainer width="100%" height={320}>
                  <BarChart data={top_selling_products} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={140}
                      tick={{ fontSize: 9 }}
                      angle={0}
                      textAnchor="end"
                      interval={0}
                    />
                    <Tooltip 
                      contentStyle={{ fontSize: '12px' }}
                      formatter={(value, name) => {
                        if (name === 'Quantity Sold') return [value, 'Quantity'];
                        if (name === 'Revenue') return [formatCurrencyPHP(value), 'Revenue'];
                        return [value, name];
                      }}
                    />
                    <Legend wrapperStyle={{ fontSize: 12 }} />
                    <Bar dataKey="total_quantity" fill="#6366F1" name="Quantity Sold" />
                    <Bar dataKey="total_revenue" fill="#F59E42" name="Revenue" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Package className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No data available</h3>
                  <p className="text-gray-400 text-sm max-w-md text-center">
                    This could be because there are no completed orders yet or the system is still collecting data.
                  </p>
                </div>
              )}
            </div>
          </div>
          
          {/* Revenue by Category */}
          <div className="card chart-card relative">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Revenue by Category</h3>
              {revenue_per_category && revenue_per_category.length > 0 && (
                <button
                  onClick={() => setExpandedChart('revenue-category')}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
            <div className="h-[300px]">
              {revenue_per_category && revenue_per_category.length > 0 ? (() => {
                // Sort data by revenue descending and calculate total
                const sortedData = [...revenue_per_category]
                  .map(item => ({
                    ...item,
                    total_revenue: Number(item.total_revenue) || 0
                  }))
                  .sort((a, b) => b.total_revenue - a.total_revenue);
                const totalRevenue = sortedData.reduce((sum, item) => sum + item.total_revenue, 0);
                
                return (
                  <ResponsiveContainer width="100%" height={300}>
                    <PieChart>
                      <Pie 
                        data={sortedData}
                        dataKey="total_revenue" 
                        nameKey="category" 
                        cx="50%" 
                        cy="45%" 
                        innerRadius={40}
                        outerRadius={90} 
                        label={false}
                      >
                        {sortedData.map((entry, idx) => (
                          <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name, props) => [
                          formatCurrencyPHP(value), 
                          `${props.payload.category}: ${((value / totalRevenue) * 100).toFixed(1)}%`
                        ]} 
                      />
                      <Legend 
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry, index) => {
                          const item = sortedData[index];
                          const percent = totalRevenue > 0 ? ((item.total_revenue / totalRevenue) * 100).toFixed(1) : '0';
                          return `${value} (${percent}%)`;
                        }}
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Package className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No data available</h3>
                  <p className="text-gray-400 text-sm max-w-md text-center">
                    This could be because there are no completed orders yet or the system is still collecting data.
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Revenue by Brand */}
          <div className="card chart-card relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><Package className="h-5 w-5 text-blue-500" /><h3 className="text-lg font-bold text-gray-900">Revenue by Brand</h3></div>
              {revenue_per_brand && revenue_per_brand.length > 0 && (
                <button
                  onClick={() => setExpandedChart('revenue-brand')}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
            <div className="h-[250px]">
              {revenue_per_brand && revenue_per_brand.length > 0 ? (() => {
                // Normalize brand names (handle duplicates like "DEEP COOL" vs "DEEPCOOL")
                const normalizeBrand = (brand) => {
                  if (!brand) return '';
                  return brand.trim().toUpperCase().replace(/\s+/g, ' ');
                };
                
                // Group and merge similar brand names
                const brandMap = new Map();
                revenue_per_brand.forEach(item => {
                  const normalized = normalizeBrand(item.brand);
                  const existing = brandMap.get(normalized);
                  if (existing) {
                    existing.total_revenue = (Number(existing.total_revenue) || 0) + (Number(item.total_revenue) || 0);
                  } else {
                    brandMap.set(normalized, {
                      ...item,
                      brand: item.brand, // Keep original brand name for display
                      total_revenue: Number(item.total_revenue) || 0
                    });
                  }
                });
                
                // Sort data by revenue descending and calculate total
                const sortedData = Array.from(brandMap.values())
                  .sort((a, b) => b.total_revenue - a.total_revenue);
                const totalRevenue = sortedData.reduce((sum, item) => sum + item.total_revenue, 0);
                
                return (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie 
                        data={sortedData}
                        dataKey="total_revenue" 
                        nameKey="brand" 
                        cx="50%" 
                        cy="45%" 
                        innerRadius={35}
                        outerRadius={80} 
                        label={false}
                      >
                        {sortedData.map((entry, idx) => (
                          <Cell key={`brand-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name, props) => [
                          formatCurrencyPHP(value), 
                          `${props.payload.brand}: ${((value / totalRevenue) * 100).toFixed(1)}%`
                        ]} 
                      />
                      <Legend 
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry, index) => {
                          const item = sortedData[index];
                          const percent = totalRevenue > 0 ? ((item.total_revenue / totalRevenue) * 100).toFixed(1) : '0';
                          return `${value} (${percent}%)`;
                        }}
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Package className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No data available</h3>
                  <p className="text-gray-400 text-sm max-w-md text-center">
                    This could be because there are no completed orders yet or the system is still collecting data.
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Order Status Breakdown */}
          <div className="card chart-card relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><PieIcon className="h-5 w-5 text-green-500" /><h3 className="text-lg font-bold text-gray-900">Order Status Breakdown</h3></div>
              {order_status_breakdown && order_status_breakdown.length > 0 && (
                <button
                  onClick={() => setExpandedChart('order-status')}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
            <div className="h-[250px]">
              {order_status_breakdown && order_status_breakdown.length > 0 ? (() => {
                // Sort data by count descending and calculate total
                const sortedData = [...order_status_breakdown]
                  .map(item => ({
                    ...item,
                    count: Number(item.count) || 0
                  }))
                  .sort((a, b) => b.count - a.count);
                const totalCount = sortedData.reduce((sum, item) => sum + item.count, 0);
                
                return (
                  <ResponsiveContainer width="100%" height={250}>
                    <PieChart>
                      <Pie 
                        data={sortedData}
                        dataKey="count" 
                        nameKey="status" 
                        cx="50%" 
                        cy="45%" 
                        innerRadius={35}
                        outerRadius={80} 
                        label={false}
                      >
                        {sortedData.map((entry, idx) => (
                          <Cell key={`status-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={2} />
                        ))}
                      </Pie>
                      <Tooltip 
                        formatter={(value, name, props) => [
                          `${value} orders`, 
                          `${props.payload.status}: ${((value / totalCount) * 100).toFixed(1)}%`
                        ]} 
                      />
                      <Legend 
                        verticalAlign="bottom"
                        height={36}
                        formatter={(value, entry, index) => {
                          const item = sortedData[index];
                          const percent = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
                          return `${value} (${item.count}, ${percent}%)`;
                        }}
                        wrapperStyle={{ fontSize: '11px', paddingTop: '10px' }}
                      />
                    </PieChart>
                  </ResponsiveContainer>
                );
              })() : (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Package className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No data available</h3>
                  <p className="text-gray-400 text-sm max-w-md text-center">
                    This could be because there are no completed orders yet or the system is still collecting data.
                  </p>
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Stock Movement & Deadstock */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* Stock Movement */}
          <div className="card chart-card relative">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2"><TrendingUp className="h-5 w-5 text-teal-500" /><h3 className="text-lg font-bold text-gray-900">Stock Movement (Last 30 Days)</h3></div>
              {stock_movement && stock_movement.length > 0 && (
                <button
                  onClick={() => setExpandedChart('stock-movement')}
                  className="p-1.5 hover:bg-gray-100 rounded transition-colors"
                  title="Expand chart"
                >
                  <Maximize2 className="h-4 w-4 text-gray-600" />
                </button>
              )}
            </div>
            <div className="h-[250px]">
              {stock_movement && stock_movement.length > 0 ? (
                <ResponsiveContainer width="100%" height={250}>
                  <BarChart data={stock_movement} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis type="number" />
                    <YAxis 
                      dataKey="name" 
                      type="category" 
                      width={140}
                      tick={{ fontSize: 9 }}
                      angle={0}
                      textAnchor="end"
                      interval={0}
                    />
                    <Tooltip 
                      contentStyle={{ fontSize: '12px' }}
                    />
                    <Legend />
                    <Bar dataKey="sold_last_30_days" fill="#22D3EE" name="Sold (30d)" />
                  </BarChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6">
                  <Package className="w-12 h-12 text-gray-300 mb-4" />
                  <h3 className="text-lg font-medium text-gray-500 mb-2 text-center">No data available</h3>
                  <p className="text-gray-400 text-sm max-w-md text-center">
                    This could be because there are no completed orders in the last 30 days or the system is still collecting data.
                  </p>
                </div>
              )}
            </div>
          </div>
          {/* Deadstock */}
          {/* This section is now redundant as the Deadstock card is moved */}
        </div>

        {/* Average Order Value */}
        <div className="card p-8 max-w-md mx-auto mt-10 flex flex-col items-center">
          <div className="flex items-center gap-2 mb-2"><PieIcon className="h-7 w-7 text-indigo-500" /><h3 className="text-lg font-bold text-gray-900">Average Order Value</h3></div>
          <div className="text-4xl font-extrabold text-green-700">{formatCurrencyPHP(average_order_value?.avg_order_value || 0)}</div>
        </div>
      </div>

      {/* Expanded Chart Modal */}
      {expandedChart && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={() => setExpandedChart(null)}>
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-6xl max-h-[90vh] overflow-y-auto relative" onClick={e => e.stopPropagation()}>
            {/* Close Button */}
            <button
              onClick={() => setExpandedChart(null)}
              className="absolute top-4 right-4 bg-gray-100 hover:bg-red-100 text-gray-500 hover:text-red-600 rounded-full p-2 transition-colors shadow z-10"
              title="Close"
            >
              <X className="h-5 w-5" />
            </button>

            {/* Expanded Chart Content */}
            <div className="p-8">
              {expandedChart === 'top-selling' && top_selling_products && top_selling_products.length > 0 && (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-2">Top-Selling Products</h3>
                  <p className="text-sm text-gray-500 mb-6">Qty vs Revenue</p>
                  <div className="h-[600px]">
                    <ResponsiveContainer width="100%" height={600}>
                      <BarChart data={top_selling_products} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={180}
                          tick={{ fontSize: 11 }}
                          angle={0}
                          textAnchor="end"
                          interval={0}
                        />
                        <Tooltip 
                          contentStyle={{ fontSize: '14px' }}
                          formatter={(value, name) => {
                            if (name === 'Quantity Sold') return [value, 'Quantity'];
                            if (name === 'Revenue') return [formatCurrencyPHP(value), 'Revenue'];
                            return [value, name];
                          }}
                        />
                        <Legend wrapperStyle={{ fontSize: 14 }} />
                        <Bar dataKey="total_quantity" fill="#6366F1" name="Quantity Sold" />
                        <Bar dataKey="total_revenue" fill="#F59E42" name="Revenue" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {expandedChart === 'revenue-category' && revenue_per_category && revenue_per_category.length > 0 && (() => {
                // Sort data by revenue descending and calculate total
                const sortedData = [...revenue_per_category]
                  .map(item => ({
                    ...item,
                    total_revenue: Number(item.total_revenue) || 0
                  }))
                  .sort((a, b) => b.total_revenue - a.total_revenue);
                const totalRevenue = sortedData.reduce((sum, item) => sum + item.total_revenue, 0);
                
                return (
                  <>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Revenue by Category</h3>
                    <div className="h-[600px]">
                      <ResponsiveContainer width="100%" height={600}>
                        <PieChart>
                          <Pie 
                            data={sortedData}
                            dataKey="total_revenue" 
                            nameKey="category" 
                            cx="50%" 
                            cy="45%" 
                            innerRadius={80}
                            outerRadius={180} 
                            label={false}
                          >
                            {sortedData.map((entry, idx) => (
                              <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => [
                              formatCurrencyPHP(value), 
                              `${props.payload.category}: ${((value / totalRevenue) * 100).toFixed(1)}%`
                            ]} 
                          />
                          <Legend 
                            verticalAlign="bottom"
                            height={50}
                            formatter={(value, entry, index) => {
                              const item = sortedData[index];
                              const percent = totalRevenue > 0 ? ((item.total_revenue / totalRevenue) * 100).toFixed(1) : '0';
                              return `${value} (${percent}%)`;
                            }}
                            wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                );
              })()}

              {expandedChart === 'revenue-brand' && revenue_per_brand && revenue_per_brand.length > 0 && (() => {
                // Normalize brand names (handle duplicates like "DEEP COOL" vs "DEEPCOOL")
                const normalizeBrand = (brand) => {
                  if (!brand) return '';
                  return brand.trim().toUpperCase().replace(/\s+/g, ' ');
                };
                
                // Group and merge similar brand names
                const brandMap = new Map();
                revenue_per_brand.forEach(item => {
                  const normalized = normalizeBrand(item.brand);
                  const existing = brandMap.get(normalized);
                  if (existing) {
                    existing.total_revenue = (Number(existing.total_revenue) || 0) + (Number(item.total_revenue) || 0);
                  } else {
                    brandMap.set(normalized, {
                      ...item,
                      brand: item.brand, // Keep original brand name for display
                      total_revenue: Number(item.total_revenue) || 0
                    });
                  }
                });
                
                // Sort data by revenue descending and calculate total
                const sortedData = Array.from(brandMap.values())
                  .sort((a, b) => b.total_revenue - a.total_revenue);
                const totalRevenue = sortedData.reduce((sum, item) => sum + item.total_revenue, 0);
                
                return (
                  <>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Revenue by Brand</h3>
                    <div className="h-[600px]">
                      <ResponsiveContainer width="100%" height={600}>
                        <PieChart>
                          <Pie 
                            data={sortedData}
                            dataKey="total_revenue" 
                            nameKey="brand" 
                            cx="50%" 
                            cy="45%" 
                            innerRadius={80}
                            outerRadius={180} 
                            label={false}
                          >
                            {sortedData.map((entry, idx) => (
                              <Cell key={`brand-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => [
                              formatCurrencyPHP(value), 
                              `${props.payload.brand}: ${((value / totalRevenue) * 100).toFixed(1)}%`
                            ]} 
                          />
                          <Legend 
                            verticalAlign="bottom"
                            height={50}
                            formatter={(value, entry, index) => {
                              const item = sortedData[index];
                              const percent = totalRevenue > 0 ? ((item.total_revenue / totalRevenue) * 100).toFixed(1) : '0';
                              return `${value} (${percent}%)`;
                            }}
                            wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                );
              })()}

              {expandedChart === 'order-status' && order_status_breakdown && order_status_breakdown.length > 0 && (() => {
                // Sort data by count descending and calculate total
                const sortedData = [...order_status_breakdown]
                  .map(item => ({
                    ...item,
                    count: Number(item.count) || 0
                  }))
                  .sort((a, b) => b.count - a.count);
                const totalCount = sortedData.reduce((sum, item) => sum + item.count, 0);
                
                return (
                  <>
                    <h3 className="text-2xl font-bold text-gray-900 mb-6">Order Status Breakdown</h3>
                    <div className="h-[600px]">
                      <ResponsiveContainer width="100%" height={600}>
                        <PieChart>
                          <Pie 
                            data={sortedData}
                            dataKey="count" 
                            nameKey="status" 
                            cx="50%" 
                            cy="45%" 
                            innerRadius={80}
                            outerRadius={180} 
                            label={false}
                          >
                            {sortedData.map((entry, idx) => (
                              <Cell key={`status-${idx}`} fill={COLORS[idx % COLORS.length]} stroke="#fff" strokeWidth={2} />
                            ))}
                          </Pie>
                          <Tooltip 
                            formatter={(value, name, props) => [
                              `${value} orders`, 
                              `${props.payload.status}: ${((value / totalCount) * 100).toFixed(1)}%`
                            ]} 
                          />
                          <Legend 
                            verticalAlign="bottom"
                            height={50}
                            formatter={(value, entry, index) => {
                              const item = sortedData[index];
                              const percent = totalCount > 0 ? ((item.count / totalCount) * 100).toFixed(1) : '0';
                              return `${value} (${item.count}, ${percent}%)`;
                            }}
                            wrapperStyle={{ fontSize: '14px', paddingTop: '20px' }}
                          />
                        </PieChart>
                      </ResponsiveContainer>
                    </div>
                  </>
                );
              })()}

              {expandedChart === 'stock-movement' && stock_movement && stock_movement.length > 0 && (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Stock Movement (Last 30 Days)</h3>
                  <div className="h-[600px]">
                    <ResponsiveContainer width="100%" height={600}>
                      <BarChart data={stock_movement} layout="vertical" margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis 
                          dataKey="name" 
                          type="category" 
                          width={180}
                          tick={{ fontSize: 11 }}
                          angle={0}
                          textAnchor="end"
                          interval={0}
                        />
                        <Tooltip 
                          contentStyle={{ fontSize: '14px' }}
                        />
                        <Legend wrapperStyle={{ fontSize: 14 }} />
                        <Bar dataKey="sold_last_30_days" fill="#22D3EE" name="Sold (30d)" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                </>
              )}

              {expandedChart === 'sales-overview' && salesChartData && salesChartData.length > 0 && (
                <>
                  <h3 className="text-2xl font-bold text-gray-900 mb-6">Sales Overview - {salesChartTitle}</h3>
                  <div className="h-[600px]">
                    {salesChartType === 'monthly' && (
                      <ResponsiveContainer width="100%" height={600}>
                        <LineChart data={monthly_sales} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottomRight', offset: 0 }} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total_sales" stroke="#6366F1" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                    {salesChartType === 'weekly' && (
                      <ResponsiveContainer width="100%" height={600}>
                        <LineChart data={weekly_sales} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottomRight', offset: 0 }} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Line type="monotone" dataKey="total_sales" stroke="#22D3EE" strokeWidth={3} />
                        </LineChart>
                      </ResponsiveContainer>
                    )}
                    {salesChartType === 'daily' && (
                      <ResponsiveContainer width="100%" height={600}>
                        <BarChart data={daily_sales} margin={{ top: 10, right: 30, left: 0, bottom: 20 }}>
                          <CartesianGrid strokeDasharray="3 3" />
                          <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: 0 }} />
                          <YAxis />
                          <Tooltip />
                          <Legend />
                          <Bar dataKey="total_sales" fill="#F59E42" />
                        </BarChart>
                      </ResponsiveContainer>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SystemReports; 