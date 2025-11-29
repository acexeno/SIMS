# Sales Prediction System Guide

## Overview

The Sales Prediction System in your PC component e-commerce platform uses historical sales data to predict future sales trends. This helps you make informed decisions about inventory management, marketing strategies, and business planning.

## How Past Sales Data Predicts Future Sales

### 1. **Data Collection & Storage**
Your system automatically tracks:
- **Order History**: Every completed order with date, total amount, and status
- **Component Sales**: Individual component sales through `order_items` table
- **Customer Behavior**: Purchase patterns and preferences
- **Seasonal Trends**: Time-based sales variations

### 2. **Prediction Algorithms**

#### **Moving Average Method**
- **How it works**: Calculates the average of recent sales periods
- **Best for**: Smoothing out short-term fluctuations
- **Example**: If last 3 months had sales of ₱100k, ₱120k, ₱110k, next month prediction = ₱110k

#### **Linear Trend Analysis**
- **How it works**: Identifies if sales are growing, declining, or stable over time
- **Best for**: Long-term business growth planning
- **Example**: If sales increased by ₱10k each month, predicts ₱130k for next month

#### **Seasonal Analysis**
- **How it works**: Identifies recurring patterns (holiday spikes, back-to-school, etc.)
- **Best for**: PC components with seasonal demand (gaming gear, school laptops)
- **Example**: GPU sales spike in December (gaming season), predict similar spike next December

#### **Exponential Smoothing**
- **How it works**: Gives more weight to recent data while considering historical trends
- **Best for**: Adapting to changing market conditions
- **Example**: Recent sales trend is more important than old data

### 3. **Combined Prediction**
The system combines all methods with confidence scores to provide the most accurate prediction possible.

## Using the Sales Prediction System

### **Step 1: Access the Dashboard**
1. Log in as Admin, Super Admin, or Employee
2. Navigate to the Sales Prediction Dashboard
3. Set your prediction parameters

### **Step 2: Configure Parameters**
- **Time Period**: Choose daily, weekly, or monthly analysis
- **Forecast Periods**: How many periods ahead to predict (1-12)
- **Component Filter**: Predict for specific components (optional)
- **Category Filter**: Predict for specific categories (optional)

### **Step 3: Generate Predictions**
Click "Generate Predictions" to analyze your data and get forecasts.

### **Step 4: Interpret Results**
- **Confidence Score**: How reliable the prediction is (0-100%)
- **Predicted Sales**: Expected sales amount for future periods
- **Recommendations**: Actionable insights based on predictions

## Real-World Examples

### **Example 1: Gaming Component Sales**
```
Historical Data (Last 6 months):
- July: ₱50,000 (summer low)
- August: ₱75,000 (back-to-school)
- September: ₱60,000
- October: ₱80,000 (pre-holiday)
- November: ₱90,000 (Black Friday prep)
- December: ₱120,000 (holiday season)

Prediction for January: ₱70,000
Confidence: 85%
Recommendation: "Sales predicted to decrease by 42% from December. Consider promotional strategies to maintain momentum."
```

### **Example 2: CPU Sales Trend**
```
Historical Data (Last 12 months):
- Consistent growth of ₱5,000 per month
- Seasonal spike in Q4 (₱20,000 above trend)

Prediction for Next 3 months:
- Month 1: ₱85,000
- Month 2: ₱90,000  
- Month 3: ₱95,000

Confidence: 78%
Recommendation: "Strong upward trend detected. Consider increasing inventory to meet demand."
```

## API Usage Examples

### **Get Predictions (GET)**
```javascript
// Get monthly predictions for next 3 months
const response = await fetch('/backend/api/sales_prediction.php?period=monthly&forecast_months=3', {
    headers: {
        'Authorization': `Bearer ${token}`
    }
});

const data = await response.json();
console.log(data.predictions);
```

### **Generate New Predictions (POST)**
```javascript
// Generate predictions for specific component
const response = await fetch('/backend/api/sales_prediction.php', {
    method: 'POST',
    headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
    },
    body: JSON.stringify({
        period: 'weekly',
        forecast_months: 4,
        component_id: 123
    })
});
```

## Business Applications

### **1. Inventory Management**
- **Overstock Prevention**: Predict low-demand periods to reduce ordering
- **Stockout Prevention**: Predict high-demand periods to increase inventory
- **Cash Flow Planning**: Plan purchases based on predicted revenue

### **2. Marketing Strategy**
- **Promotional Timing**: Launch promotions during predicted low-sales periods
- **Product Focus**: Emphasize products with predicted high demand
- **Seasonal Campaigns**: Plan campaigns around predicted seasonal spikes

### **3. Financial Planning**
- **Revenue Forecasting**: Predict monthly/quarterly revenue for budgeting
- **Growth Planning**: Identify growth trends for business expansion
- **Risk Management**: Identify potential sales declines early

## Setup Instructions

### **1. Run Database Migration**
```bash
php backend/migrations/create_sales_predictions_table.php
```

### **2. Add to Admin Dashboard**
Add the SalesPredictionDashboard component to your admin dashboard:

```jsx
import SalesPredictionDashboard from '../components/SalesPredictionDashboard';

// In your admin dashboard
<SalesPredictionDashboard />
```

### **3. Test the System**
1. Ensure you have some completed orders in your system
2. Access the Sales Prediction Dashboard
3. Generate predictions for different time periods
4. Verify the results make sense based on your historical data

## Troubleshooting

### **"Insufficient historical data"**
- **Cause**: Less than 3 data points available
- **Solution**: Wait for more sales data or use shorter time periods

### **Low confidence scores**
- **Cause**: High variability in sales data
- **Solution**: Consider external factors (seasonality, promotions) or use longer historical periods

### **Predictions seem inaccurate**
- **Cause**: Market changes, new products, or external events
- **Solution**: Review and adjust parameters, consider recent trends more heavily

## Best Practices

### **1. Regular Updates**
- Generate predictions monthly or quarterly
- Update parameters based on business changes
- Review and adjust based on actual results

### **2. Combine with Business Knowledge**
- Use predictions as guidance, not absolute truth
- Consider external factors (holidays, promotions, market changes)
- Adjust predictions based on business intelligence

### **3. Monitor Accuracy**
- Track prediction accuracy over time
- Identify which methods work best for your business
- Refine parameters based on performance

## Technical Details

### **Database Tables**
- `sales_predictions`: Stores generated predictions
- `sales_analytics`: Stores historical analysis data
- `orders` & `order_items`: Source data for predictions

### **API Endpoints**
- `GET /backend/api/sales_prediction.php`: Retrieve predictions
- `POST /backend/api/sales_prediction.php`: Generate new predictions

### **Frontend Component**
- `SalesPredictionDashboard.jsx`: React component for the prediction interface
- Uses Recharts for data visualization
- Responsive design for mobile and desktop

## Conclusion

The Sales Prediction System transforms your historical sales data into actionable business intelligence. By understanding past patterns and predicting future trends, you can make more informed decisions about inventory, marketing, and business strategy.

Remember: Predictions are tools to guide decisions, not absolute guarantees. Always combine data-driven insights with your business knowledge and market understanding.
