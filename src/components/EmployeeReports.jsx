import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  LineChart, 
  Line, 
  BarChart, 
  Bar, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  Legend, 
  PieChart, 
  Pie, 
  Cell 
} from 'recharts';
import { 
  Calendar, 
  Package, 
  PieChart as PieIcon, 
  BarChart2, 
  TrendingUp,
  Clock,
  CheckCircle,
  AlertCircle,
  Truck,
  RefreshCw
} from 'lucide-react';
import { formatCurrencyPHP } from '../utils/currency';

// Improved color palette with better distinction between colors
const COLORS = [
  '#6366F1', // indigo
  '#10B981', // emerald
  '#F59E0B', // amber
  '#EF4444', // red
  '#8B5CF6', // violet
  '#06B6D4', // cyan
  '#EC4899', // pink
  '#F97316', // orange
  '#84CC16', // lime
  '#14B8A6'  // teal
];

const statusIcons = {
  completed: <CheckCircle className="w-4 h-4 mr-1 text-green-600" />,
  processing: <RefreshCw className="w-4 h-4 mr-1 text-blue-600 animate-spin" />,
  shipped: <Truck className="w-4 h-4 mr-1 text-purple-600" />,
  pending: <Clock className="w-4 h-4 mr-1 text-yellow-600" />,
  cancelled: <AlertCircle className="w-4 h-4 mr-1 text-red-600" />
};

const AdminReports = ({ reports = {}, orders = [] }) => {
  const [salesChartType, setSalesChartType] = useState('monthly');
  const [isLoading, setIsLoading] = useState(true);
  
  // Use centralized currency formatting
  const formatCurrency = (amount) => formatCurrencyPHP(amount);

  // Destructure with defaults
  const {
    monthly_sales = [],
    daily_sales = [],
    weekly_sales = [],
    top_selling_products = [],
    revenue_per_category = [],
    order_status_breakdown = [],
    total_sales = 0,
    total_orders = 0,
    average_order_value = {},
    conversion_rate = 0
  } = reports;

  // Simulate loading
  useEffect(() => {
    const timer = setTimeout(() => {
      setIsLoading(false);
    }, 500);
    return () => clearTimeout(timer);
  }, []);

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
            <Line type="monotone" dataKey="total_sales" name="Total Sales" stroke="#6366F1" strokeWidth={3} />
          </LineChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No sales data available</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto text-center leading-relaxed">
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
            <Line type="monotone" dataKey="total_sales" name="Total Sales" stroke="#22D3EE" strokeWidth={3} />
          </LineChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No weekly data available</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto text-center leading-relaxed">
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
            <Bar dataKey="total_sales" name="Total Sales" fill="#F59E42" />
          </BarChart>
        ) : (
          <div className="flex flex-col items-center justify-center h-full p-6 text-center">
            <Package className="w-12 h-12 text-gray-300 mb-4" />
            <h3 className="text-lg font-medium text-gray-500 mb-2">No daily data available</h3>
            <p className="text-gray-400 text-sm max-w-md mx-auto text-center leading-relaxed">
              This could be because there are no completed orders yet or the system is still collecting data.
            </p>
          </div>
        )}
      </ResponsiveContainer>
    );
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-indigo-500"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 md:p-6">
      <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
        <h1 className="text-2xl font-bold text-gray-900">Sales Dashboard</h1>
        <div className="mt-2 md:mt-0 flex items-center space-x-2">
          <div className="relative">
            <select
              value={salesChartType}
              onChange={(e) => setSalesChartType(e.target.value)}
              className="block w-full pl-3 pr-10 py-2 text-base border-gray-300 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md"
            >
              <option value="monthly">Monthly</option>
              <option value="weekly">Weekly</option>
              <option value="daily">Daily</option>
            </select>
          </div>
        </div>
      </div>
      
      {/* Key Metrics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-indigo-50 text-indigo-600">
              <span className="text-xl font-bold">₱</span>
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Sales</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(total_sales)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-green-50 text-green-600">
              <Package className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Total Orders</p>
              <p className="text-xl font-semibold text-gray-900">{total_orders}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-blue-50 text-blue-600">
              <BarChart2 className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Avg. Order Value</p>
              <p className="text-xl font-semibold text-gray-900">{formatCurrency(average_order_value?.avg_order_value || 0)}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center">
            <div className="p-3 rounded-full bg-purple-50 text-purple-600">
              <TrendingUp className="h-6 w-6" />
            </div>
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-500">Conversion Rate</p>
              <p className="text-xl font-semibold text-gray-900">{conversion_rate}%</p>
            </div>
          </div>
        </div>
      </div>

      {/* Sales Chart */}
      <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 mb-6">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between mb-6">
          <h3 className="text-lg font-semibold text-gray-900">Sales Performance</h3>
          <div className="inline-flex rounded-md shadow-sm mt-2 md:mt-0" role="group">
            <button
              onClick={() => setSalesChartType('monthly')}
              className={`px-4 py-2 text-sm font-medium rounded-l-lg ${
                salesChartType === 'monthly' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border'
              }`}
            >
              Monthly
            </button>
            <button
              onClick={() => setSalesChartType('weekly')}
              className={`px-4 py-2 text-sm font-medium ${
                salesChartType === 'weekly' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-t border-b border-r'
              }`}
            >
              Weekly
            </button>
            <button
              onClick={() => setSalesChartType('daily')}
              className={`px-4 py-2 text-sm font-medium rounded-r-lg ${
                salesChartType === 'daily' 
                  ? 'bg-indigo-600 text-white' 
                  : 'bg-white text-gray-700 hover:bg-gray-50 border-t border-b border-r rounded-r-md'
              }`}
            >
              Daily
            </button>
          </div>
        </div>
        {salesChartComponent}
      </div>

      {/* Analytics Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Selling Products */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Top Selling Products</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {top_selling_products?.length || 0} items
            </span>
          </div>
          <div className="space-y-4">
            {top_selling_products && top_selling_products.length > 0 ? (
              top_selling_products.slice(0, 5).map((product, index) => (
                <div 
                  key={product.id || index} 
                  className="flex items-center justify-between p-3 hover:bg-gray-50 rounded-lg transition-colors"
                >
                  <div className="flex items-center space-x-3">
                    <div className="flex-shrink-0 w-10 h-10 bg-gray-100 rounded-lg flex items-center justify-center text-gray-500">
                      {index < 3 ? (
                        <span className="font-medium text-indigo-600">{index + 1}</span>
                      ) : (
                        <span className="text-sm font-medium text-gray-400">{index + 1}</span>
                      )}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{product.name}</p>
                      <p className="text-xs text-gray-500">{product.total_quantity || 0} sold</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-gray-900">
                    {formatCurrency(product.total_revenue || 0)}
                  </span>
                </div>
              ))
            ) : (
              <div className="flex flex-col items-center justify-center py-8 text-center">
                <Package className="w-10 h-10 text-gray-300 mb-2" />
                <p className="text-gray-500">No product data available</p>
                <p className="text-xs text-gray-400 mt-1">Products will appear here as they sell</p>
              </div>
            )}
          </div>
        </div>

        {/* Revenue by Category */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-lg font-semibold text-gray-900">Revenue by Category</h3>
            <span className="text-xs bg-gray-100 text-gray-600 px-2 py-1 rounded-full">
              {revenue_per_category?.length || 0} categories
            </span>
          </div>
          <div className="h-64">
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
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie
                      data={sortedData}
                      cx="50%"
                      cy="45%"
                      innerRadius={35}
                      outerRadius={75}
                      label={false}
                      dataKey="total_revenue"
                      nameKey="category"
                    >
                      {sortedData.map((entry, index) => (
                        <Cell 
                          key={`cell-${index}`} 
                          fill={COLORS[index % COLORS.length]} 
                          stroke="#fff"
                          strokeWidth={2}
                        />
                      ))}
                    </Pie>
                    <Tooltip 
                      formatter={(value, name, props) => [
                        formatCurrencyPHP(value), 
                        `${props.payload.category}: ${((value / totalRevenue) * 100).toFixed(1)}%`
                      ]}
                      labelFormatter={(name) => `Category: ${name}`}
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
              <div className="flex flex-col items-center justify-center h-full text-center p-6">
                <PieIcon className="w-12 h-12 text-gray-300 mb-2" />
                <p className="text-gray-500">No category data available</p>
                <p className="text-xs text-gray-400 mt-1">Categories will appear when you have sales</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Recent Orders & Status */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Orders */}
        <div className="lg:col-span-2 bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Recent Orders</h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Order #</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Customer</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Amount</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Date</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {orders && orders.length > 0 ? (
                  orders.slice(0, 5).map((order) => (
                    <tr key={order.id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-indigo-600">
                        #{order.id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="text-sm font-medium text-gray-900">
                          {order.user?.name || `Customer #${order.user_id || 'N/A'}`}
                        </div>
                        <div className="text-xs text-gray-500">
                          {order.email || ''}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {formatCurrency(order.total || 0)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="flex items-center">
                          {statusIcons[order.status?.toLowerCase()] || statusIcons.pending}
                          <span className={`text-xs font-medium px-2.5 py-0.5 rounded-full ${
                            order.status === 'completed' ? 'bg-green-100 text-green-800' :
                            order.status === 'processing' ? 'bg-blue-100 text-blue-800' :
                            order.status === 'shipped' ? 'bg-purple-100 text-purple-800' :
                            order.status === 'cancelled' ? 'bg-red-100 text-red-800' :
                            'bg-yellow-100 text-yellow-800'
                          }`}>
                            {order.status ? order.status.charAt(0).toUpperCase() + order.status.slice(1) : 'Pending'}
                          </span>
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {order.created_at ? new Date(order.created_at).toLocaleDateString('en-PH', {
                          month: 'short',
                          day: 'numeric',
                          year: 'numeric',
                        }) : 'N/A'}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="5" className="px-6 py-8 text-center">
                      <div className="flex flex-col items-center justify-center">
                        <Package className="w-12 h-12 text-gray-300 mb-2" />
                        <p className="text-gray-500">No recent orders found</p>
                        <p className="text-sm text-gray-400 mt-1">New orders will appear here</p>
                      </div>
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          <div className="px-6 py-3 bg-gray-50 text-right text-xs">
            <a href="/admin/orders" className="text-indigo-600 hover:text-indigo-900 font-medium">
              View all orders →
            </a>
          </div>
        </div>

        {/* Order Status */}
        <div className="bg-white rounded-lg shadow-sm border border-gray-100">
          <div className="p-6 border-b border-gray-200">
            <h3 className="text-lg font-semibold text-gray-900">Order Status</h3>
          </div>
          <div className="p-6">
            {order_status_breakdown && order_status_breakdown.length > 0 ? (
              <div className="space-y-4">
                {order_status_breakdown.map((status) => (
                  <div key={status.status} className="mb-4">
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-sm font-medium text-gray-700">
                        {status.status ? status.status.charAt(0).toUpperCase() + status.status.slice(1) : 'Unknown'}
                      </span>
                      <span className="text-sm font-semibold text-gray-900">
                        {status.count || 0}
                      </span>
                    </div>
                    <div className="w-full bg-gray-200 rounded-full h-2">
                      <div 
                        className={`h-2 rounded-full ${
                          status.status === 'completed' ? 'bg-green-500' :
                          status.status === 'processing' ? 'bg-blue-500' :
                          status.status === 'shipped' ? 'bg-purple-500' :
                          status.status === 'cancelled' ? 'bg-red-500' :
                          'bg-yellow-500'
                        }`}
                        style={{
                          width: `${(status.count / order_status_breakdown.reduce((sum, s) => sum + (s.count || 0), 0)) * 100}%`
                        }}
                      ></div>
                    </div>
                  </div>
                ))}
                <div className="mt-6 pt-6 border-t border-gray-200">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">Total Orders</span>
                    <span className="text-sm font-semibold text-gray-900">
                      {order_status_breakdown.reduce((sum, status) => sum + (status.count || 0), 0)}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-8">
                <Package className="mx-auto h-12 w-12 text-gray-300" />
                <h3 className="mt-2 text-sm font-medium text-gray-900">No orders</h3>
                <p className="mt-1 text-sm text-gray-500">Get started by creating a new order.</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default AdminReports;