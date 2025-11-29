# Super Admin User & Password Management Guide

## Overview
This guide explains the new user creation and password management features for Super Admin users in the SIMS (PC Building Platform) system.

## Features Implemented

### 1. Auto-Generate Secure Passwords
- **Backend API Endpoint**: `GET /index.php?endpoint=generate_password`
- **Frontend Integration**: "Generate" button in Create User and Change Password modals
- **Password Requirements**:
  - Length: 6-8 characters (configurable)
  - Must include at least one uppercase letter
  - Must include at least one lowercase letter
  - Must include at least one number
  - Must include at least one special character (!@#$%^&*)

### 2. Create User with Fixed Credentials

#### How to Create an Employee Account:
1. Log in as **Super Admin**
2. Navigate to the **User** tab
3. Click the **"Create User"** button
4. Fill in the required information:
   - Username
   - Email
   - First name
   - Last name
   - Select **"Employee"** from the Role dropdown
5. Click the **"Generate"** button to auto-generate a secure password
6. **IMPORTANT**: Copy and save the generated password immediately
7. Click **"Copy"** button to copy password to clipboard (optional)
8. Click **"Create"** to create the user

#### How to Create an Admin Account:
Follow the same steps as above, but select **"Admin"** from the Role dropdown instead of "Employee".

### 3. Password Management Features

#### Change Password for Any User:
1. In the **User Management** table, locate the user
2. Click the **"Change Password"** button for that user
3. Click **"Generate"** to auto-generate a new secure password
4. **IMPORTANT**: Copy and save the new password
5. Click **"Copy"** button to copy password to clipboard
6. Click **"Change Password"** to apply the changes
7. Provide the new credentials to the user

#### Change Your Own Password (Super Admin):
Super Admin users can change their own password using the same Change Password button in the user table.

### 4. Security Features
- Only Super Admin users can access these features
- All password changes are logged in the security logs
- Passwords are hashed using bcrypt before storage
- Generated passwords meet all security requirements automatically
- OTP bypass for Super Admin when creating users (ADMIN_OVERRIDE)

## API Endpoints

### Generate Password
```
GET /index.php?endpoint=generate_password
Authorization: Bearer {token}

Response:
{
  "success": true,
  "password": "Abc123!@"
}
```

### Change User Password (Super Admin)
```
PUT /index.php?endpoint=admin_change_password
Authorization: Bearer {token}
Content-Type: application/json

Request Body:
{
  "user_id": 123,
  "new_password": "NewPass123!"
}

Response:
{
  "success": true,
  "message": "Password changed successfully"
}
```

## Important Notes

### Password Security:
1. **Always save generated passwords immediately** - they cannot be recovered once the modal is closed
2. Provide the credentials to the user through a secure channel
3. Advise users to change their password after first login (if self-service is enabled)

### User Account Types:
- **Client**: Regular users who can browse and purchase
- **Employee**: Staff with access to inventory, orders, and chat support
- **Admin**: Management with full system access except user management
- **Super Admin**: Full system access including user creation and management

### Access Permissions:
After creating a user, Super Admin can toggle:
- **Inventory Access**: Enable/Disable inventory management
- **Orders Access**: Enable/Disable order management
- **Chat Support Access**: Enable/Disable chat support features

### User Deletion:
- Only **Employee** and **Admin** accounts can be deleted
- **Super Admin** accounts are protected from deletion
- Deletion is permanent and cannot be undone

## Workflow Example

### Creating an Employee Account:
1. Super Admin clicks "Create User"
2. Fills in:
   - Username: `employee1`
   - Email: `employee1@builditpc.com`
   - First name: `John`
   - Last name: `Doe`
   - Role: `Employee`
3. Clicks "Generate" → Password: `Hf3@kL9p`
4. Copies password to clipboard
5. Clicks "Create"
6. Provides credentials to John Doe:
   - Username: `employee1`
   - Password: `Hf3@kL9p`
7. John Doe can now log in with these credentials

### Changing an Employee's Password:
1. Employee forgot their password and requests reset
2. Super Admin finds the employee in the User table
3. Clicks "Change Password" for that employee
4. Clicks "Generate" → New password: `Yz5!mN2k`
5. Copies password to clipboard
6. Clicks "Change Password"
7. Provides new password to employee through secure channel

## Technical Implementation

### Backend Files Modified:
1. `backend/api/index.php` - Added endpoints for password generation and admin password change
2. `backend/config/security.php` - Added `generateSecurePassword()` function

### Frontend Files Modified:
1. `src/pages/SuperAdminDashboard.jsx` - Added password generation and change password modals

### Key Functions:
- `generateSecurePassword($requirements)` - Generates passwords meeting security requirements
- `handleGeneratePassword()` - Frontend handler for password generation
- `handleChangePasswordClick(user)` - Opens change password modal for a user
- `handleSubmitPasswordChange()` - Submits password change request

## Troubleshooting

### Issue: Password generation fails
**Solution**: Ensure you are logged in as Super Admin and have a valid session token.

### Issue: Cannot change password for Super Admin
**Solution**: Super Admin passwords can be changed. Ensure the account is not protected by other mechanisms.

### Issue: Generated password doesn't meet requirements
**Solution**: The auto-generated passwords always meet requirements. If manual entry fails, check:
- Length is between 6-8 characters
- Contains at least one uppercase letter
- Contains at least one lowercase letter
- Contains at least one number
- Contains at least one special character

### Issue: User can't login with generated password
**Solution**: 
- Verify the password was copied correctly (check for extra spaces)
- Ensure the account is Active (Status column shows "Active")
- Check that proper permissions are enabled

## Best Practices

1. **Always use the Generate button** instead of manually creating passwords
2. **Document credentials securely** - use a password manager or secure document
3. **Change default passwords** after first login when possible
4. **Regularly audit user accounts** and disable unused accounts
5. **Log all administrative actions** for security compliance
6. **Use strong, unique passwords** for all accounts, especially Super Admin

## Support

For issues or questions about user management:
1. Check this guide first
2. Review the system logs for error messages
3. Contact the system administrator
4. Refer to the main README.md for general system information

---

**Last Updated**: October 30, 2025
**Version**: 1.0
**Maintained by**: SIMS Development Team

