# How to Fix Your "Sample Admin Account" 🔧

## Current Status of Your Account

**Account Name:** Sample Admin Account
**Problem 1:** Created as **Employee** (not Admin) - Cannot manage prebuilts
**Problem 2:** Tried logging in with wrong credentials

---

## ✅ Solution: Create a New Admin Account

Since the "Sample Admin Account" was created as Employee, here's how to create a proper Admin account:

### Step 1: Login as Super Admin
```
Use your Super Admin credentials
Go to: User tab
```

### Step 2: Create New Admin Account (Correctly This Time!)

1. **Click "Create User"**

2. **Fill in the form:**
   ```
   Username: admin.test
   Email: admin.test@gmail.com
   First name: Admin
   Last name: Test
   Role: Admin ⚠️ MAKE SURE TO SELECT "Admin" NOT "Employee"!
   ```

3. **Generate Password:**
   ```
   Click "Generate" button
   Example password: "Zx5@Km8N"
   ```

4. **SAVE THESE CREDENTIALS:**
   ```
   📋 Copy and paste somewhere safe:
   
   Username: admin.test
   Password: Zx5@Km8N
   
   (Use the actual password shown, not this example!)
   ```

5. **Click "Create"**

   You should see an alert like:
   ```
   ✅ User created successfully as Admin!
   
   ━━━━━━━━━━━━━━━━━━━━━━━━━━
   📋 LOGIN CREDENTIALS:
   ━━━━━━━━━━━━━━━━━━━━━━━━━━
   
   👤 Username: admin.test
   🔑 Password: Zx5@Km8N
   
   ⚠️ IMPORTANT:
   • Use the USERNAME (not email) to login
   • Copy these credentials now
   ```

### Step 3: Test the New Admin Account

1. **Logout from Super Admin**
   ```
   Click "Logout" button
   ```

2. **Login with NEW Admin credentials:**
   ```
   Username or Email field: admin.test
   Password field: Zx5@Km8N
   
   ⚠️ Use USERNAME not email!
   ```

3. **Verify Admin Access:**
   ```
   After login, check:
   - Can you access Prebuilt PC menu?
   - Can you add/edit/delete prebuilts?
   - Can you manage inventory?
   - Can you view orders?
   ```

### Step 4: (Optional) Delete the Old Employee Account

1. **Login as Super Admin**

2. **Go to User tab**

3. **Find "Sample Admin Account" in the table**

4. **Click "Delete" button**
   ```
   Confirm deletion
   ```

---

## ✅ Alternative: Fix the Existing Account Role

If you want to keep the "Sample Admin Account" username, you'll need to update it in the database:

### Option A: Ask Developer to Update Database

**SQL Command:**
```sql
-- Remove Employee role
DELETE FROM user_roles 
WHERE user_id = (SELECT id FROM users WHERE username = 'Sample Admin Account')
AND role_id = (SELECT id FROM roles WHERE name = 'Employee');

-- Add Admin role
INSERT INTO user_roles (user_id, role_id)
SELECT u.id, r.id
FROM users u, roles r
WHERE u.username = 'Sample Admin Account'
AND r.name = 'Admin';
```

### Option B: Use Super Admin to Change Password

If the password isn't working:

1. **Login as Super Admin**
2. **Go to User tab**
3. **Find "Sample Admin Account"**
4. **Click "Change Password"**
5. **Generate new password**
6. **Copy the new password**
7. **Try logging in with:**
   ```
   Username: Sample Admin Account
   Password: [new generated password]
   ```

---

## 🔍 Verify Account Details

### To check what role an account has:

1. **Login as Super Admin**
2. **Go to User tab**
3. **Look at the "Roles" column**
   ```
   Sample Admin Account | Roles: Employee ❌
   admin.test          | Roles: Admin ✅
   ```

### Database Query to Check:
```sql
SELECT 
    u.username,
    u.email,
    GROUP_CONCAT(r.name) as roles,
    u.can_access_inventory,
    u.can_access_orders,
    u.can_access_chat_support
FROM users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
LEFT JOIN roles r ON ur.role_id = r.id
WHERE u.username = 'Sample Admin Account'
GROUP BY u.id;
```

**Expected result for Admin:**
```
username: Sample Admin Account
roles: Admin
can_access_inventory: 1
can_access_orders: 1
can_access_chat_support: 1
```

---

## 📋 Correct Login Credentials for Sample Admin

**If you want to try the original account first:**

The credentials shown in your first screenshot were:
```
Username: Sample Admin Account
Password: L#D3Du*F
```

**Try logging in with:**
1. Username field: `Sample Admin Account` (exact, with spaces!)
2. Password field: `L#D3Du*F` (exact, case-sensitive!)

**NOT:**
- ❌ SampleAdmin@gmail.com
- ❌ xa4NAT%Q

---

## 🎯 Recommended Action Plan

### Best Approach:

1. ✅ **Create a new Admin account** with a simple username like `admin.test`
2. ✅ **Test that it works** (login, check prebuilt access)
3. ✅ **Delete the old "Sample Admin Account"** if you don't need it
4. ✅ **Use the new account** for testing admin functions

### Why This Is Better:

- ✅ Clean start with correct role
- ✅ Fresh credentials you know for sure
- ✅ No database manipulation needed
- ✅ Tested workflow
- ✅ Simple username without spaces

---

## ⚠️ Important Reminders

### When Creating Admin Accounts:

1. **Always select "Admin" from Role dropdown** before creating
2. **Use simple usernames** without spaces (e.g., admin.test, john.doe)
3. **Save the password immediately** after generation
4. **Test login right away** to verify credentials work
5. **Remember:** Login uses USERNAME, not email!

### Roles Explanation:

| Role | Can Manage Prebuilts? | Can Manage Users? |
|------|----------------------|-------------------|
| **Employee** | ❌ No | ❌ No |
| **Admin** | ✅ Yes | ❌ No |
| **Super Admin** | ✅ Yes | ✅ Yes |

**Why "Sample Admin Account" can't manage prebuilts:**
- It was created with **Employee** role
- Only **Admin** and **Super Admin** can manage prebuilts

---

## 🆘 If You're Still Having Issues

### Quick Fixes:

1. **Try OTP Login:**
   ```
   Click "Use OTP instead" on login page
   Enter email: builditPC@gmail.com
   Use OTP code sent to email
   ```

2. **Reset Password via Super Admin:**
   ```
   Login as Super Admin
   User tab → Find user → Change Password
   Generate new password
   ```

3. **Create a test account:**
   ```
   Username: test.admin
   Role: Admin
   Try logging in with this one
   ```

### Contact Super Admin:

If you can't fix it yourself:
1. Ask Super Admin to create a new Admin account for you
2. Provide desired username (e.g., "yourname.admin")
3. Super Admin will give you the credentials
4. Login and test

---

## ✅ Success Checklist

After creating/fixing your Admin account, verify:

- [ ] Can login with username + password
- [ ] Can access Prebuilt PC section
- [ ] Can add new prebuilts
- [ ] Can edit existing prebuilts
- [ ] Can delete prebuilts
- [ ] Can manage inventory
- [ ] Can view/manage orders
- [ ] Can access chat support
- [ ] Role shows as "Admin" in user table

If all checkboxes are ✅, your Admin account is working correctly!

---

**Quick Start Command:**
```
1. Login as Super Admin
2. Create User
3. Role: Admin ⚠️
4. Generate Password
5. Save credentials
6. Test login
```

That's it! 🎉

---

**Created:** October 30, 2025
**Issue:** Sample Admin Account with wrong role and credentials
**Solution:** Create new Admin account or fix role in database
**Status:** ✅ Guide Complete

