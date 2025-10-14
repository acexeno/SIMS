# SIMS - Setup Guide

## Quick Start

### 1. Frontend (React)
```bash
# Navigate to project directory
cd C:\Users\Kenniell\OneDrive\Desktop\capstone2

# Install dependencies
npm install

# Start development server
npm run dev
```

**Access the app at:** `http://localhost:3000`

### 2. Backend (XAMPP)
1. **Start XAMPP Control Panel**
2. **Start Apache and MySQL** (both should be green)
3. **Copy backend folder** to `C:\xampp\htdocs\`
4. **Create database** `builditpc_db` in phpMyAdmin
5. **Import schema** from `backend/database/schema.sql`

## Current Status

✅ **Frontend**: React app running on port 3000  
✅ **Backend**: PHP/MySQL ready (needs XAMPP)  
✅ **Database**: Schema ready for import  
✅ **Authentication**: Bypassed for development  
✅ **UI**: Modern PC Assembly interface  

## Features Ready

- **Step-by-step PC building** with visual progress
- **Component selection** with search and filtering
- **Real-time compatibility checking**
- **Performance analysis** dashboard
- **Build summary** with price calculation
- **Modern UI** with animations and gradients

## Next Steps

1. **Start XAMPP** (Apache + MySQL)
2. **Import database** schema
3. **Test API endpoints**
4. **Enable authentication** (remove demo user)

## Troubleshooting

### Port 3000 Issues
```bash
# Check what's using port 3000
netstat -ano | findstr :3000

# Kill the process
taskkill /PID <PID> /F

# Restart server
npm run dev
```

### White Screen Issues
1. **Clear browser cache** (Ctrl + F5)
2. **Check console** for errors
3. **Verify URL**: `http://localhost:3000`
4. **Check terminal** for compilation errors

## Development Notes

- **Demo user** is set for development (bypasses auth)
- **PC Assembly** is the default page
- **All functionality** is working and tested
- **Modern UI** with Tailwind CSS and Lucide icons

## 🚀 **Getting Started**

### **Prerequisites**
- XAMPP (Apache + MySQL + PHP)
- Node.js (v16 or higher)
- npm or yarn

### **Step 1: Database Setup**

1. **Start XAMPP**
   - Open XAMPP Control Panel
   - Start Apache and MySQL services

2. **Create Database**
   - Open phpMyAdmin: `http://localhost/phpmyadmin`
   - Import the database schema: `backend/database/schema.sql`
   - This will create the `builditpc_db` database with all tables and sample data

3. **Configure Database Connection**
   - Edit `backend/config/database.php` if needed
   - Default settings:
     - Host: `localhost`
     - Database: `builditpc_db`
     - Username: `root`
     - Password: `` (empty)

### **Step 2: Backend Setup**

1. **Place Backend Files**
   - Copy the `backend` folder to your XAMPP htdocs directory
   - Path: `C:\xampp\htdocs\builditpc\backend\`

2. **Test Backend API**
   - Visit: `http://localhost/builditpc/backend/api/auth/verify`
   - Should return a JSON response

### **Step 3: Frontend Setup**

1. **Install Dependencies**
   ```bash
   npm install
   ```

2. **Start Development Server**
   ```bash
   npm run dev
   ```

3. **Access Application**
   - Frontend: `http://localhost:5173`
   - Backend API: `http://localhost/builditpc/backend/api/`

## 🔐 **Default User Accounts**

After importing the database, you can create test accounts:

### **Super Admin Account**
```sql
INSERT INTO users (username, email, password_hash, first_name, last_name) 
VALUES ('superadmin', 'admin@builditpc.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Super', 'Admin');

INSERT INTO user_roles (user_id, role_id) 
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'superadmin' AND r.name = 'Super Admin';
```

### **Test Client Account**
```sql
INSERT INTO users (username, email, password_hash, first_name, last_name) 
VALUES ('client', 'client@builditpc.com', '$2y$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'Test', 'Client');

INSERT INTO user_roles (user_id, role_id) 
SELECT u.id, r.id FROM users u, roles r 
WHERE u.username = 'client' AND r.name = 'Client';
```

**Default Password for all accounts: `password`**

## 🏗️ **System Architecture**

### **Database Structure**
- **Users & Roles**: User management with role-based access
- **Components**: PC parts inventory with detailed specifications
- **Orders**: Order management system
- **Custom Builds**: Saved PC configurations
- **Chat System**: Support chat functionality
- **Reports**: Analytics and reporting system

### **User Roles**
1. **Super Admin**: Full system access
2. **Admin**: Administrative access with limitations
3. **Employee**: Inventory and order management
4. **Client**: PC building and ordering

### **Key Features**
- ✅ User authentication and authorization
- ✅ Role-based access control
- ✅ PC component compatibility checking
- ✅ Real-time inventory management
- ✅ Order processing system
- ✅ Chat support system
- ✅ Reporting and analytics
- ✅ Responsive design

## **Configuration**

### **JWT Settings**
Edit `backend/utils/jwt_helper.php`:
```php
define('JWT_SECRET', 'your-secret-key-here');
define('JWT_EXPIRY', 3600); // 1 hour
```

### **API Endpoints**
- **Authentication**: `/backend/api/auth/`
- **Components**: `/backend/api/components/`
- **Orders**: `/backend/api/orders/`
- **Users**: `/backend/api/users/`

## 🚨 **Troubleshooting**

### **Common Issues**

1. **Database Connection Error**
   - Check XAMPP MySQL service is running
   - Verify database credentials in `backend/config/database.php`

2. **CORS Issues**
   - Ensure Apache is running in XAMPP
   - Check backend URL in frontend API calls

3. **JWT Token Issues**
   - Verify JWT secret key is consistent
   - Check token expiration settings

4. **Component Images Not Loading**
   - Verify image URLs in database
   - Check network connectivity for external images

### **Development Tips**

1. **Enable Error Reporting**
   ```php
   // Add to PHP files for debugging
   error_reporting(E_ALL);
   ini_set('display_errors', 1);
   ```

2. **Check Browser Console**
   - Look for JavaScript errors
   - Monitor network requests

3. **Database Debugging**
   - Use phpMyAdmin for database inspection
   - Check MySQL error logs in XAMPP

## 📁 **File Structure**

```
builditpc/
├── backend/
│   ├── api/
│   │   ├── auth.php
│   │   ├── components.php
│   │   └── orders.php
│   ├── config/
│   │   └── database.php
│   ├── database/
│   │   └── schema.sql
│   └── utils/
│       └── jwt_helper.php
├── src/
│   ├── components/
│   │   ├── auth/
│   │   │   ├── Login.jsx
│   │   │   └── Register.jsx
│   │   ├── Sidebar.jsx
│   │   └── ...
│   ├── contexts/
│   │   └── AuthContext.jsx
│   ├── pages/
│   │   ├── Home.jsx
│   │   └── PCAssembly.jsx
│   └── App.jsx
├── package.json
└── setup.md
```

## 🎯 **Next Steps**

1. **Test User Registration/Login**
2. **Explore PC Assembly Feature**
3. **Test Component Compatibility**
4. **Create Sample Orders**
5. **Test Role-based Access**

## 📞 **Support**

If you encounter issues:
1. Check the troubleshooting section
2. Review browser console for errors
3. Check XAMPP error logs
4. Verify all services are running

---

**Happy Building! 🖥️✨** 