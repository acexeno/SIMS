import React, { useState } from 'react';
import { formatCurrencyPHP } from '../utils/currency';
import { ResponsiveContainer, LineChart, Line, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, PieChart, Pie, Cell } from 'recharts';
import { TrendingUp, PieChart as PieIcon, Package, Award, Layers, AlertTriangle, BarChart3, Eye, EyeOff } from 'lucide-react';

const COLORS = ['#6366F1', '#22D3EE', '#F59E42', '#F472B6', '#A3E635', '#F87171', '#60A5FA', '#FBBF24', '#34D399', '#818CF8'];

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
  const itemsPerPage = 10;
  const allowedCategoryNames = [
    'CPU', 'Motherboard', 'GPU', 'RAM', 'Storage', 'PSU', 'Case', 'Cooler',
    'Procie Only', 'Mobo', 'Ram 3200mhz', 'Ssd Nvme', 'Psu - Tr', 'Case Gaming', 'Aio'
  ];
  const componentCategories = (categories || []).filter(cat => allowedCategoryNames.includes(cat.name));
  const deadstockComponentIds = inventory.filter(item => {
    const cat = categories.find(c => String(c.id) === String(item.category_id));
    return cat && allowedCategoryNames.includes(cat.name);
  }).map(item => item.id);
  const filteredDeadstockRaw = deadstock.filter(item => deadstockComponentIds.includes(item.id));
  const deadstockCategoryIds = Array.from(new Set(
    filteredDeadstockRaw.map(item => {
      const catId = inventory.find(comp => comp.id === item.id)?.category_id;
      return catId ? String(catId) : null;
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
        {monthly_sales && monthly_sales.length > 0 ? (
          <LineChart data={monthly_sales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" label={{ value: 'Month', position: 'insideBottomRight', offset: 0 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total_sales" stroke="#6366F1" strokeWidth={3} />
          </LineChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No sales data available</h3>
            <p className="text-gray-400 mt-2">
              This could be because there are no completed orders yet or the system is still collecting data.
            </p>
          </div>
        )}
      </ResponsiveContainer>
    );
  } else if (salesChartType === 'weekly') {
    salesChartData = weekly_sales;
    salesChartTitle = 'Weekly Sales';
    salesChartComponent = (
      <ResponsiveContainer width="100%" height={250}>
        {weekly_sales && weekly_sales.length > 0 ? (
          <LineChart data={weekly_sales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="week" label={{ value: 'Week', position: 'insideBottomRight', offset: 0 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Line type="monotone" dataKey="total_sales" stroke="#22D3EE" strokeWidth={3} />
          </LineChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No sales data available</h3>
            <p className="text-gray-400 mt-2">
              This could be because there are no completed orders yet or the system is still collecting data.
            </p>
          </div>
        )}
      </ResponsiveContainer>
    );
  } else if (salesChartType === 'daily') {
    salesChartData = daily_sales;
    salesChartTitle = 'Daily Sales (Last 30 Days)';
    salesChartComponent = (
      <ResponsiveContainer width="100%" height={250}>
        {daily_sales && daily_sales.length > 0 ? (
          <BarChart data={daily_sales} margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="day" label={{ value: 'Day', position: 'insideBottomRight', offset: 0 }} />
            <YAxis />
            <Tooltip />
            <Legend />
            <Bar dataKey="total_sales" fill="#F59E42" />
          </BarChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No sales data available</h3>
            <p className="text-gray-400 mt-2">
              This could be because there are no completed orders yet or the system is still collecting data.
            </p>
          </div>
        )}
      </ResponsiveContainer>
    );
  }

  return (
    <div className="page-container space-y-8">
      <h2 className="page-title">Sales Reports & Analytics</h2>
      {/* Friendly KPIs */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div className="card">
          <div className="text-sm text-gray-500">Average Order Value</div>
          <div className="text-2xl font-bold text-gray-900">{formatCurrencyPHP(average_order_value?.value || 0)}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Top Category</div>
          <div className="text-2xl font-bold text-gray-900">{(revenue_per_category?.[0]?.category) || '—'}</div>
        </div>
        <div className="card">
          <div className="text-sm text-gray-500">Top Product</div>
          <div className="text-2xl font-bold text-gray-900">{(top_selling_products?.[0]?.product_name) || '—'}</div>
        </div>
      </div>
      <div className="space-y-6">

        {/* Sales Chart Card */}
        <div className="card chart-card">
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
            </div>
          </div>
          <div className="h-[320px]">
            {salesChartComponent}
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
                <div className="text-center py-4 w-full">No deadstock data available.</div>
              )}
            </div>
          </div>
        )}

        {/* Analytics Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Top-Selling Products */}
          <div className="card chart-card">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-gray-900">Top-Selling Products</h3>
            <span className="text-xs text-gray-500">Qty vs Revenue</span>
          </div>
          <div className="h-[320px]">
              {top_selling_products && top_selling_products.length > 0 ? (
                <BarChart data={top_selling_products} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis dataKey="name" type="category" width={120} />
                  <Tooltip />
                <Legend wrapperStyle={{ fontSize: 12 }} />
                  <Bar dataKey="total_quantity" fill="#6366F1" name="Quantity Sold" />
                  <Bar dataKey="total_revenue" fill="#F59E42" name="Revenue" />
                </BarChart>
              ) : (
                <div className="flex items-center justify-center h-full text-gray-400">No data available</div>
              )}
            </div>
          </div>
          
          {/* Revenue by Category */}
          <div className="card chart-card">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Revenue by Category</h3>
            <div className="h-[300px] flex items-center justify-center">
              {revenue_per_category && revenue_per_category.length > 0 ? (
                <PieChart width={350} height={250}>
                  <Pie 
                    data={revenue_per_category} 
                    dataKey="total_revenue" 
                    nameKey="category" 
                    cx="50%" 
                    cy="50%" 
                    outerRadius={80} 
                    label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                  >
                    {revenue_per_category.map((entry, idx) => (
                      <Cell key={`cell-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value) => [formatCurrencyPHP(value), 'Revenue']} />
                  <Legend />
                </PieChart>
              ) : (
                <div className="text-gray-400">No data available</div>
              )}
            </div>
          </div>
          {/* Revenue by Brand */}
          <div className="card chart-card">
            <div className="flex items-center gap-2 mb-4"><Package className="h-5 w-5 text-blue-500" /><h3 className="text-lg font-bold text-gray-900">Revenue by Brand</h3></div>
            <ResponsiveContainer width="100%" height={250}>
              {revenue_per_brand && revenue_per_brand.length > 0 ? (
                <PieChart>
                  <Pie data={revenue_per_brand} dataKey="total_revenue" nameKey="brand" cx="50%" cy="50%" outerRadius={80} label>
                    {revenue_per_brand.map((entry, idx) => (
                      <Cell key={`brand-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No sales data available</h3>
            <p className="text-gray-400 mt-2">
              This could be because there are no completed orders yet or the system is still collecting data.
            </p>
          </div>
              )}
            </ResponsiveContainer>
          </div>
          {/* Order Status Breakdown */}
          <div className="card chart-card">
            <div className="flex items-center gap-2 mb-4"><PieIcon className="h-5 w-5 text-green-500" /><h3 className="text-lg font-bold text-gray-900">Order Status Breakdown</h3></div>
            <ResponsiveContainer width="100%" height={250}>
              {order_status_breakdown && order_status_breakdown.length > 0 ? (
                <PieChart>
                  <Pie data={order_status_breakdown} dataKey="count" nameKey="status" cx="50%" cy="50%" outerRadius={80} label>
                    {order_status_breakdown.map((entry, idx) => (
                      <Cell key={`status-${idx}`} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip />
                  <Legend />
                </PieChart>
              ) : (
                <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500">No sales data available</h3>
            <p className="text-gray-400 mt-2">
              This could be because there are no completed orders yet or the system is still collecting data.
            </p>
          </div>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Stock Movement & Deadstock */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 mt-8">
          {/* Stock Movement */}
          <div className="card chart-card">
            <div className="flex items-center gap-2 mb-4"><TrendingUp className="h-5 w-5 text-teal-500" /><h3 className="text-lg font-bold text-gray-900">Stock Movement (Last 30 Days)</h3></div>
            <ResponsiveContainer width="100%" height={250}>
              <BarChart data={stock_movement} layout="vertical" margin={{ top: 10, right: 20, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis dataKey="name" type="category" width={120} />
                <Tooltip />
                <Legend />
                <Bar dataKey="sold_last_30_days" fill="#22D3EE" name="Sold (30d)" />
              </BarChart>
            </ResponsiveContainer>
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
    </div>
  );
};

export default SystemReports; 