import React, { useState, useEffect } from 'react';
import { 
    LineChart, 
    Line, 
    XAxis, 
    YAxis, 
    CartesianGrid, 
    Tooltip, 
    Legend, 
    ResponsiveContainer,
    BarChart,
    Bar,
    PieChart,
    Pie,
    Cell
} from 'recharts';

const SalesPredictionDashboard = () => {
    const [predictions, setPredictions] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [parameters, setParameters] = useState({
        period: 'monthly',
        forecast_months: 3,
        component_id: '',
        category_id: ''
    });
    const [components, setComponents] = useState([]);
    const [categories, setCategories] = useState([]);

    // Colors for different prediction methods
    const colors = {
        moving_average: '#8884d8',
        linear_trend: '#82ca9d',
        seasonal_analysis: '#ffc658',
        exponential_smoothing: '#ff7300',
        combined: '#ff0000'
    };

    useEffect(() => {
        fetchComponents();
        fetchCategories();
    }, []);

    const fetchComponents = async () => {
        try {
            const response = await fetch('/api/get_all_components.php');
            const data = await response.json();
            if (data.success) {
                setComponents(data.data);
            }
        } catch (error) {
            console.error('Error fetching components:', error);
        }
    };

    const fetchCategories = async () => {
        try {
            const response = await fetch('/api/get_all_categories.php');
            const data = await response.json();
            if (data.success) {
                setCategories(data.data);
            }
        } catch (error) {
            console.error('Error fetching categories:', error);
        }
    };

    const generatePredictions = async () => {
        setLoading(true);
        setError(null);

        try {
            const token = localStorage.getItem('token');
            const response = await fetch('/backend/api/sales_prediction.php', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(parameters)
            });

            const data = await response.json();
            
            if (data.success) {
                setPredictions(data.predictions);
            } else {
                setError(data.error || 'Failed to generate predictions');
            }
        } catch (error) {
            setError('Error generating predictions: ' + error.message);
        } finally {
            setLoading(false);
        }
    };

    const formatCurrency = (value) => {
        return new Intl.NumberFormat('en-PH', {
            style: 'currency',
            currency: 'PHP'
        }).format(value);
    };

    const formatChartData = (historicalData, predictions) => {
        const chartData = [];
        
        // Add historical data
        historicalData.forEach((item, index) => {
            chartData.push({
                period: item.period,
                actual: item.total_sales,
                type: 'Historical'
            });
        });

        // Add predictions
        if (predictions && predictions.combined_prediction) {
            predictions.combined_prediction.forEach((pred, index) => {
                chartData.push({
                    period: `F${pred.period}`,
                    predicted: pred.predicted_sales,
                    confidence: pred.confidence,
                    type: 'Predicted'
                });
            });
        }

        return chartData;
    };

    const renderPredictionMethods = () => {
        if (!predictions || !predictions.prediction_methods) return null;

        const methods = predictions.prediction_methods;
        const methodData = Object.entries(methods).map(([method, data]) => ({
            method: method.replace('_', ' ').toUpperCase(),
            predictions: data.length,
            avgConfidence: data.length > 0 ? 
                (data.reduce((sum, item) => sum + item.confidence, 0) / data.length).toFixed(2) : 0
        }));

        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Prediction Methods Analysis</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {methodData.map((item, index) => (
                        <div key={index} className="text-center p-4 border rounded">
                            <div className="text-sm font-medium text-gray-600">{item.method}</div>
                            <div className="text-2xl font-bold text-blue-600">{item.predictions}</div>
                            <div className="text-xs text-gray-500">Avg Confidence: {item.avgConfidence}</div>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    const renderRecommendations = () => {
        if (!predictions || !predictions.recommendations) return null;

        return (
            <div className="bg-white p-6 rounded-lg shadow">
                <h3 className="text-lg font-semibold mb-4">Recommendations</h3>
                <div className="space-y-2">
                    {predictions.recommendations.map((rec, index) => (
                        <div key={index} className="flex items-start space-x-2">
                            <div className="w-2 h-2 bg-blue-500 rounded-full mt-2 flex-shrink-0"></div>
                            <p className="text-gray-700">{rec}</p>
                        </div>
                    ))}
                </div>
            </div>
        );
    };

    return (
        <div className="p-6 max-w-7xl mx-auto">
            <div className="mb-8">
                <h1 className="text-3xl font-bold text-gray-900 mb-2">Sales Prediction Dashboard</h1>
                <p className="text-gray-600">
                    Analyze past sales data to predict future sales trends and make informed business decisions.
                </p>
            </div>

            {/* Parameters Form */}
            <div className="bg-white p-6 rounded-lg shadow mb-6">
                <h2 className="text-xl font-semibold mb-4">Prediction Parameters</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Time Period
                        </label>
                        <select
                            value={parameters.period}
                            onChange={(e) => setParameters({...parameters, period: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="daily">Daily</option>
                            <option value="weekly">Weekly</option>
                            <option value="monthly">Monthly</option>
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Forecast Periods
                        </label>
                        <input
                            type="number"
                            min="1"
                            max="12"
                            value={parameters.forecast_months}
                            onChange={(e) => setParameters({...parameters, forecast_months: parseInt(e.target.value)})}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Component (Optional)
                        </label>
                        <select
                            value={parameters.component_id}
                            onChange={(e) => setParameters({...parameters, component_id: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Components</option>
                            {components.map(comp => (
                                <option key={comp.id} value={comp.id}>{comp.name}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-2">
                            Category (Optional)
                        </label>
                        <select
                            value={parameters.category_id}
                            onChange={(e) => setParameters({...parameters, category_id: e.target.value})}
                            className="w-full p-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        >
                            <option value="">All Categories</option>
                            {categories.map(cat => (
                                <option key={cat.id} value={cat.id}>{cat.name}</option>
                            ))}
                        </select>
                    </div>
                </div>

                <div className="mt-4">
                    <button
                        onClick={generatePredictions}
                        disabled={loading}
                        className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {loading ? 'Generating Predictions...' : 'Generate Predictions'}
                    </button>
                </div>
            </div>

            {/* Error Display */}
            {error && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded mb-6">
                    {error}
                </div>
            )}

            {/* Predictions Display */}
            {predictions && (
                <div className="space-y-6">
                    {/* Summary Cards */}
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-2">Confidence Score</h3>
                            <div className="text-3xl font-bold text-blue-600">
                                {(predictions.confidence_score * 100).toFixed(1)}%
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Overall prediction confidence
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-2">Next Period Prediction</h3>
                            <div className="text-3xl font-bold text-green-600">
                                {formatCurrency(predictions.combined_prediction?.[0]?.predicted_sales || 0)}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Predicted sales for next {parameters.period}
                            </p>
                        </div>

                        <div className="bg-white p-6 rounded-lg shadow">
                            <h3 className="text-lg font-semibold mb-2">Historical Data Points</h3>
                            <div className="text-3xl font-bold text-purple-600">
                                {predictions.historical_data?.length || 0}
                            </div>
                            <p className="text-sm text-gray-600 mt-1">
                                Data points used for analysis
                            </p>
                        </div>
                    </div>

                    {/* Sales Trend Chart */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">Sales Trend & Predictions</h3>
                        <ResponsiveContainer width="100%" height={400}>
                            <LineChart data={formatChartData(predictions.historical_data, predictions)}>
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="period" />
                                <YAxis tickFormatter={(value) => formatCurrency(value)} />
                                <Tooltip formatter={(value) => formatCurrency(value)} />
                                <Legend />
                                <Line 
                                    type="monotone" 
                                    dataKey="actual" 
                                    stroke="#8884d8" 
                                    strokeWidth={2}
                                    name="Historical Sales"
                                    dot={{ fill: '#8884d8' }}
                                />
                                <Line 
                                    type="monotone" 
                                    dataKey="predicted" 
                                    stroke="#82ca9d" 
                                    strokeWidth={2}
                                    strokeDasharray="5 5"
                                    name="Predicted Sales"
                                    dot={{ fill: '#82ca9d' }}
                                />
                            </LineChart>
                        </ResponsiveContainer>
                    </div>

                    {/* Prediction Methods */}
                    {renderPredictionMethods()}

                    {/* Recommendations */}
                    {renderRecommendations()}

                    {/* Detailed Predictions Table */}
                    <div className="bg-white p-6 rounded-lg shadow">
                        <h3 className="text-lg font-semibold mb-4">Detailed Predictions</h3>
                        <div className="overflow-x-auto">
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Period
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Predicted Sales
                                        </th>
                                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                            Confidence
                                        </th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {predictions.combined_prediction?.map((pred, index) => (
                                        <tr key={index}>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                                                {parameters.period} {pred.period}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                {formatCurrency(pred.predicted_sales)}
                                            </td>
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <div className="flex items-center">
                                                    <div className="w-full bg-gray-200 rounded-full h-2 mr-2">
                                                        <div 
                                                            className="bg-blue-600 h-2 rounded-full" 
                                                            style={{ width: `${pred.confidence * 100}%` }}
                                                        ></div>
                                                    </div>
                                                    <span>{(pred.confidence * 100).toFixed(1)}%</span>
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>
            )}

            {/* How It Works Section */}
            <div className="mt-12 bg-gray-50 p-6 rounded-lg">
                <h2 className="text-2xl font-bold text-gray-900 mb-4">How Sales Prediction Works</h2>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Data Sources</h3>
                        <ul className="space-y-2 text-gray-700">
                            <li>• Historical order data from your system</li>
                            <li>• Component sales patterns and trends</li>
                            <li>• Seasonal variations in PC component demand</li>
                            <li>• Category and brand performance data</li>
                        </ul>
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold mb-2">Prediction Methods</h3>
                        <ul className="space-y-2 text-gray-700">
                            <li>• <strong>Moving Average:</strong> Smooths out short-term fluctuations</li>
                            <li>• <strong>Linear Trend:</strong> Identifies growth or decline patterns</li>
                            <li>• <strong>Seasonal Analysis:</strong> Accounts for recurring patterns</li>
                            <li>• <strong>Exponential Smoothing:</strong> Gives more weight to recent data</li>
                        </ul>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default SalesPredictionDashboard;
