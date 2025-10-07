# SIMS - Desktop PC Building & Compatibility Checker System

A modern **desktop-only** web application for building custom PCs with real-time compatibility checking, user management, and comprehensive business features.

## ⚠️ Desktop-Only Application

**SIMS is designed exclusively for desktop computers and is not compatible with mobile devices or tablets.** The application requires a minimum screen width of 1024px for optimal functionality.

## Features

### For Customers
- **Desktop-Optimized Landing Page**: Beautiful homepage with system description and prebuilt PC recommendations
- **Component Selection**: Interactive component picker with search and filtering across all PC parts
- **Real-Time Compatibility Checker**: Advanced validation of component compatibility including CPU/motherboard sockets, RAM types, power requirements, and form factors
- **Component Preview**: Detailed view of selected components with specifications and pricing
- **Build Management**: Save, load, and manage multiple PC builds
- **Prebuilt PC Systems**: Browse and customize pre-configured systems
- **Order Management**: Place orders and track order status
- **Chat Support**: Real-time chat support with customer service representatives
- **Notifications**: Real-time notifications for order updates and system alerts
- **User Profiles**: Manage personal information and preferences
- **One-Click Clear**: Instantly reset your build with a single click, clearing all selected components and compatibility data
- **FAQ Section**: Comprehensive help and support information

### For Administrators & Employees
- **Role-Based Access Control**: Super Admin, Admin, Employee, and Client roles with different permissions
- **Inventory Management**: Track component stock levels, add/remove items, and manage pricing
- **Order Processing**: Process customer orders, update status, and manage fulfillment
- **Sales Reports**: Comprehensive analytics and reporting dashboard
- **User Management**: Manage customer accounts and employee access
- **Prebuilt PC Management**: Create and manage pre-configured systems
- **Chat Support Management**: Handle customer inquiries through admin chat interface with priority management and session tracking
- **System Settings**: Configure application settings and preferences
- **Statistics Dashboard**: Real-time metrics and analytics for chat support

### Technical Features
- **JWT Authentication**: Secure token-based authentication system
- **Real-Time Updates**: Live notifications and chat functionality
- **Responsive Design**: Optimized for desktop screens with enhanced UX
- **Database Management**: Comprehensive MySQL database with proper relationships
- **API-First Architecture**: RESTful API endpoints for all functionality
- **Component Database**: Extensive database of PC components with real pricing and stock information
- **Chat System**: Real-time messaging with session management and priority handling
- **Notification System**: Persistent notifications with read/unread status tracking

## Tech Stack

### Frontend
- **React 18** - Modern UI framework with hooks and context
- **Vite** - Fast build tool and development server
- **Tailwind CSS** - Utility-first CSS framework for styling
- **Lucide React** - Beautiful and consistent icon library
- **React Router** - Client-side routing and navigation
- **Recharts** - Data visualization for reports and analytics
- **Axios** - HTTP client for API communication

### Backend
- **PHP 8+** - Server-side scripting with modern features
- **MySQL** - Relational database management system
- **Apache** - Web server for hosting
- **XAMPP** - Development environment stack
- **JWT** - JSON Web Tokens for secure authentication

## Prerequisites

- **Desktop Computer** with minimum 1024px screen width
- Node.js (v16 or higher)
- XAMPP (with Apache and MySQL)
- Git

## Installation & Setup

### 1. Clone the Repository
```bash
git clone <repository-url>
cd capstone2
```

### 2. Frontend Setup
```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

The React application will be available at `http://localhost:5175` (or the port specified in package.json)

### 3. Backend Setup

#### Start XAMPP
1. Open XAMPP Control Panel
2. Start Apache and MySQL services
3. Ensure both services are running (green status)

#### Database Setup
1. Open phpMyAdmin at `http://localhost/phpmyadmin`
2. Create a new database called `sims_db` (or use existing `builditpc_db`)
3. Import the database schema:
   - Go to the database
   - Click "Import" tab
   - Choose the file `backend/database/schema.sql`
   - Click "Go" to import

#### Import Component Data
1. Use the provided CSV import script to populate the components database:
   ```bash
   php import_csv.php
   ```

#### Backend Files
1. Ensure the `backend` folder is in your XAMPP `htdocs` directory
2. The API will be available at `http://localhost/backend/api/`

## Recent Improvements

### v1.1.0 - 2024-09-16
- **Enhanced Clear Functionality**
  - One-click clearing of all selected components
  - Automatic reset of compatibility checks and recommendations
  - Clean slate for new builds with proper state management

### 4. Configuration

#### Database Connection
Edit `backend/config/database.php` if needed:
```php
$host = 'localhost';
$dbname = 'sims_db'; // or 'builditpc_db' if using existing database
$username = 'root';
$password = ''; // Set your MySQL password if different
```

#### Create Initial Users
Run the setup scripts to create initial admin users:
```bash
php create_super_admin.php
php create_employee.php
```

## Project Structure

```
capstone2/
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── AdminSidebar.jsx
│   │   ├── CompatibilityChecker.jsx
│   │   ├── ComponentPreview.jsx
│   │   ├── ComponentSelector.jsx
│   │   ├── EmployeeSidebar.jsx
│   │   ├── FloatingChatButton.jsx
│   │   ├── NotificationManager.jsx
│   │   ├── NotificationToast.jsx
│   │   ├── Sidebar.jsx
│   │   ├── SystemReports.jsx
│   │   └── TopNavigation.jsx
│   ├── contexts/
│   │   └── NotificationContext.jsx
│   ├── pages/
│   │   ├── AdminChatSupport.jsx
│   │   ├── AdminDashboard.jsx
│   │   ├── ChatSupport.jsx
│   │   ├── EmployeeDashboard.jsx
│   │   ├── Home.jsx
│   │   ├── MyBuilds.jsx
│   │   ├── MyOrders.jsx
│   │   ├── Notifications.jsx
│   │   ├── PCAssembly.jsx
│   │   ├── PrebuiltPCs.jsx
│   │   └── SuperAdminDashboard.jsx
│   ├── utils/
│   │   └── componentImages.js
│   ├── App.jsx
│   ├── main.jsx
│   └── index.css
├── backend/
│   ├── api/
│   │   ├── auth.php
│   │   ├── builds.php
│   │   ├── chat.php
│   │   ├── dashboard.php
│   │   ├── get_all_categories.php
│   │   ├── get_all_components.php
│   │   ├── get_components_by_ids.php
│   │   ├── index.php
│   │   ├── notifications.php
│   │   ├── prebuilts.php
│   │   └── update_component_stock.php
│   ├── config/
│   │   ├── cors.php
│   │   └── database.php
│   ├── database/
│   │   ├── chat_schema.sql
│   │   ├── last_seen_chat_schema.sql
│   │   ├── notifications_schema.sql
│   │   └── schema.sql
│   └── utils/
│       └── jwt_helper.php
├── public/
│   └── images/
│       ├── components/
│       └── prebuilts/
├── components_database.csv
├── package.json
├── vite.config.js
├── tailwind.config.js
├── setup.md
├── CHAT_SUPPORT_GUIDE.md
├── COMPONENT_IMAGES_GUIDE.md
└── README.md
```

## Usage

### System Requirements
- **Minimum Screen Width**: 1024px
- **Recommended Resolution**: 1920x1080 or higher
- **Browser**: Modern browsers (Chrome, Firefox, Safari, Edge)

### Customer Features

#### Home Page
- View system description and features
- Browse recommended prebuilt systems
- Access FAQ and support information
- Navigate to PC Assembly

#### PC Assembly
1. **Select Components**: Choose from different categories (CPU, Motherboard, GPU, RAM, Storage, PSU, Case, Cooler)
2. **Search & Filter**: Find specific components using search and filters
3. **Preview Components**: Click the eye icon to view detailed component information
4. **Check Compatibility**: Real-time compatibility validation with detailed feedback
5. **Build Summary**: View total price and build status
6. **Save Builds**: Save your configurations for later use

#### My Builds
- View all saved PC configurations
- Load previous builds for modification
- Delete unwanted builds
- Share build configurations

#### My Orders
- View order history and status
- Track current orders
- View order details and components

#### Chat Support
- Real-time chat with customer service
- Get help with component selection
- Technical support for PC building
- Guest chat support for non-registered users
- Quick question suggestions for common issues

### Admin Features

#### Super Admin Dashboard
- **User Management**: Create, edit, and manage user accounts
- **System Settings**: Configure application-wide settings
- **Inventory Management**: Manage component stock and pricing
- **Order Processing**: Handle customer orders and fulfillment
- **Sales Reports**: View comprehensive analytics and reports
- **Prebuilt Management**: Create and manage pre-configured systems
- **System Reports**: Monitor system performance and usage

#### Admin Dashboard
- **Inventory Management**: Track and update component stock
- **Order Processing**: Process customer orders
- **Sales Reports**: View sales analytics and trends
- **Chat Support**: Handle customer inquiries
- **Prebuilt Management**: Manage pre-configured systems

#### Employee Dashboard
- **Inventory Access**: View and update component stock
- **Order Management**: Process and track orders
- **Basic Reports**: View assigned reports and metrics

### Compatibility Checking
The system performs comprehensive compatibility checks:
- **CPU and Motherboard**: Socket compatibility (AM4, AM5, LGA1200, LGA1700)
- **RAM and Motherboard**: Memory type compatibility (DDR4, DDR5)
- **Power Supply**: Adequate wattage for all components
- **Case and Motherboard**: Form factor compatibility (ATX, mATX, ITX)
- **Cooling**: Adequate cooling for CPU and case
- **Storage**: Interface compatibility (SATA, NVMe)

## API Endpoints

### Authentication
- `POST /backend/api/index.php?endpoint=register` - User registration
- `POST /backend/api/index.php?endpoint=login` - User login
- `GET /backend/api/index.php?endpoint=profile` - Get user profile
- `PUT /backend/api/index.php?endpoint=profile` - Update user profile
- `POST /backend/api/index.php?endpoint=logout` - User logout

### OTP Email Verification
- `POST /backend/api/index.php?endpoint=otp_request` - Request an OTP to be emailed
  - JSON body: `{ "email": "user@example.com", "purpose": "login" }`
  - Response: `{ success: true, message: "OTP sent successfully" }`
- `POST /backend/api/index.php?endpoint=otp_verify` - Verify an OTP code
  - JSON body: `{ "email": "user@example.com", "purpose": "login", "code": "123456" }`
  - Response: `{ success: true, message: "OTP verified", user?: { id, username, email } }`

Notes:
- The `purpose` field can be `login`, `register`, `reset_password`, etc. Default is `login`.
- Rate limits: by default, at most 1 request per 60 seconds and up to 5 requests per hour per email/purpose.
- OTP expiry: default 5 minutes.

### Components
- `GET /backend/api/index.php?endpoint=components&category={category}` - Get components by category
- `GET /backend/api/get_all_components.php` - Get all components
- `GET /backend/api/get_components_by_ids.php?ids={ids}` - Get components by IDs
- `GET /backend/api/get_all_categories.php` - Get all categories

### Builds
- `POST /backend/api/index.php?endpoint=builds` - Create new build
- `GET /backend/api/index.php?endpoint=builds` - Get user builds
- `PUT /backend/api/index.php?endpoint=builds` - Update build
- `DELETE /backend/api/index.php?endpoint=builds` - Delete build

### Orders
- `POST /backend/api/index.php?endpoint=orders` - Create new order
- `GET /backend/api/index.php?endpoint=orders` - Get user orders
- `PUT /backend/api/index.php?endpoint=orders` - Update order status

### Chat
- `GET /backend/api/chat.php?sessions` - Get chat sessions (admin)
- `GET /backend/api/chat.php?messages&session_id=X` - Get messages for session
- `POST /backend/api/chat.php?send` - Send a message
- `POST /backend/api/chat.php?resolve` - Mark chat as resolved
- `POST /backend/api/chat.php?reopen` - Reopen resolved chat
- `GET /backend/api/chat.php?stats` - Get chat statistics
- `POST /backend/api/chat.php?update_priority` - Update chat priority

### Notifications
- `GET /backend/api/notifications.php` - Get user notifications
- `PUT /backend/api/notifications.php` - Mark notification as read

### Dashboard
- `GET /backend/api/dashboard.php?type={type}` - Get dashboard data

## Troubleshooting

### Common Issues

1. **Mobile Device Access**
   - The application will display a message indicating it's desktop-only
   - Access the application on a computer with a screen width of at least 1024px

2. **XAMPP Services Not Starting**
   - Check if ports 80 and 3306 are available
   - Restart XAMPP as administrator
   - Verify no other services are using the required ports

3. **Database Connection Issues**
   - Verify MySQL is running in XAMPP
   - Check database credentials in `backend/config/database.php`
   - Ensure the database `builditpc_db` exists

4. **API Not Responding**
   - Check Apache is running in XAMPP
   - Verify backend files are in `htdocs/backend/`
   - Check browser console for CORS errors

5. **React App Not Loading**
   - Ensure Node.js is installed
   - Run `npm install` to install dependencies
   - Check if port 5175 is available
   - Verify the development server is running

6. **Component Data Not Loading**
   - Ensure the CSV import script has been run
   - Check database tables are populated
   - Verify API endpoints are accessible

7. **Authentication Issues**
   - Clear browser localStorage
   - Check JWT token expiration
   - Verify user credentials in database

### Desktop Optimization Features
- Larger component cards and buttons for better desktop interaction
- Optimized sidebar width (280px) for desktop screens
- Enhanced typography and spacing for computer displays
- Desktop-specific hover effects and animations
- Full-screen layouts for better component viewing

## Development

### Code Style
- Use informal, conversational comments in code
- Follow React best practices with functional components and hooks
- Maintain consistent naming conventions
- Use TypeScript-style prop validation where possible

### Database Schema
The application uses a comprehensive database schema with:
- User management and role-based access
- Component inventory with detailed specifications
- Order processing and tracking
- Chat system for customer support
- Notification system for real-time updates
- Build management for saved configurations

## Recent Updates

### Version 2.0 - SIMS Rebranding
- **Complete Branding Update**: Changed from "BUILD IT:PC" to "SIMS" throughout the entire application
- **Enhanced Chat Support System**: Implemented comprehensive real-time chat functionality with:
  - Guest user support
  - Priority management (low, normal, high, urgent)
  
- **Improved Build Management**:
  - One-click clear functionality for starting new builds
  - Better state management for component selection
  - Session tracking and resolution
  - Real-time statistics dashboard
  - Quick question suggestions
- **Improved Notification System**: Enhanced notification management with persistent storage
- **Updated Documentation**: Comprehensive guides for chat support and component images
- **Database Schema Updates**: Added chat sessions, messages, and enhanced notification tables

### Key Improvements
- **Better User Experience**: More intuitive chat interface with floating button
- **Admin Efficiency**: Advanced chat management tools for support staff
- **System Reliability**: Enhanced error handling and data persistence
- **Case Compatibility**: Ensures components fit within the selected case

### Build Management
- **One-Click Clear**: Quickly reset your build with a single click
  - Removes all selected components
  - Resets compatibility checks and recommendations
  - Clears any saved build data
  - Returns to the first assembly step

## Troubleshooting guides

## License

This project is licensed under the MIT License.

---

**SIMS** - Making PC building simple, reliable, and enjoyable on desktop computers! 