# SIMS (PC Building System) - Test Case Scenarios

## Project Overview
**System Name:** SIMS - PC Building and Compatibility Checker System  
**Version:** 1.0.0  
**Technology Stack:** React, PHP, MySQL, Tailwind CSS  
**Test Date:** January 2025  

---

## Test Case Categories

### 1. USER AUTHENTICATION & AUTHORIZATION

#### TC_AUTH_001: User Registration
- **Test Case ID:** TC_AUTH_001
- **Test Description:** Verify user can register with valid information
- **Preconditions:** User is on the registration page
- **Test Steps:**
  1. Navigate to registration page
  2. Enter valid email address
  3. Enter valid password (minimum 8 characters)
  4. Enter matching confirm password
  5. Enter valid name
  6. Click "Register" button
- **Expected Result:** User account is created successfully, user is redirected to login page
- **Priority:** High
- **Test Data:** 
  - Email: testuser@example.com
  - Password: TestPass123
  - Name: Test User

#### TC_AUTH_002: User Login with Valid Credentials
- **Test Case ID:** TC_AUTH_002
- **Test Description:** Verify user can login with correct credentials
- **Preconditions:** User account exists in database
- **Test Steps:**
  1. Navigate to login page
  2. Enter valid email address
  3. Enter valid password
  4. Click "Login" button
- **Expected Result:** User is successfully logged in and redirected to appropriate dashboard
- **Priority:** High

#### TC_AUTH_003: User Login with Invalid Credentials
- **Test Case ID:** TC_AUTH_003
- **Test Description:** Verify system handles invalid login attempts
- **Preconditions:** User is on login page
- **Test Steps:**
  1. Enter invalid email address
  2. Enter invalid password
  3. Click "Login" button
- **Expected Result:** Error message displayed, user remains on login page
- **Priority:** High

#### TC_AUTH_004: Password Validation
- **Test Case ID:** TC_AUTH_004
- **Test Description:** Verify password validation rules
- **Preconditions:** User is on registration page
- **Test Steps:**
  1. Enter valid email
  2. Enter password less than 8 characters
  3. Click "Register" button
- **Expected Result:** Password validation error message displayed
- **Priority:** Medium

#### TC_AUTH_005: Session Management
- **Test Case ID:** TC_AUTH_005
- **Test Description:** Verify user session persists after page refresh
- **Preconditions:** User is logged in
- **Test Steps:**
  1. Login successfully
  2. Refresh the page
  3. Navigate to different pages
- **Expected Result:** User remains logged in, session persists
- **Priority:** High

---

### 2. PC ASSEMBLY INTERFACE

#### TC_PC_001: Component Selection - CPU
- **Test Case ID:** TC_PC_001
- **Test Description:** Verify user can select CPU component
- **Preconditions:** User is on PC Assembly page
- **Test Steps:**
  1. Click on CPU category
  2. Browse available CPUs
  3. Select a CPU from the list
  4. Verify CPU is added to build
- **Expected Result:** Selected CPU appears in build summary
- **Priority:** High

#### TC_PC_002: Component Selection - Motherboard
- **Test Case ID:** TC_PC_002
- **Test Description:** Verify user can select motherboard component
- **Preconditions:** User is on PC Assembly page
- **Test Steps:**
  1. Click on Motherboard category
  2. Browse available motherboards
  3. Select a motherboard from the list
  4. Verify motherboard is added to build
- **Expected Result:** Selected motherboard appears in build summary
- **Priority:** High

#### TC_PC_003: Component Search Functionality
- **Test Case ID:** TC_PC_003
- **Test Description:** Verify search functionality works for components
- **Preconditions:** User is on PC Assembly page, any category selected
- **Test Steps:**
  1. Enter search term in search box
  2. Verify filtered results appear
  3. Clear search term
  4. Verify all components reappear
- **Expected Result:** Search filters components correctly
- **Priority:** Medium

#### TC_PC_004: Component Sorting
- **Test Case ID:** TC_PC_004
- **Test Description:** Verify component sorting functionality
- **Preconditions:** User is on PC Assembly page, any category selected
- **Test Steps:**
  1. Select "Sort by Price" option
  2. Verify components are sorted by price (low to high)
  3. Select "Sort by Name" option
  4. Verify components are sorted alphabetically
- **Expected Result:** Components are sorted according to selected criteria
- **Priority:** Medium

#### TC_PC_005: Component Removal
- **Test Case ID:** TC_PC_005
- **Test Description:** Verify user can remove selected components
- **Preconditions:** User has selected at least one component
- **Test Steps:**
  1. Select a component
  2. Click "Remove" button
  3. Verify component is removed from build
- **Expected Result:** Component is removed from build summary
- **Priority:** High

---

### 3. COMPATIBILITY CHECKING SYSTEM

#### TC_COMPAT_001: CPU-Motherboard Compatibility
- **Test Case ID:** TC_COMPAT_001
- **Test Description:** Verify CPU and motherboard socket compatibility check
- **Preconditions:** User has selected CPU and motherboard
- **Test Steps:**
  1. Select compatible CPU (e.g., Intel LGA1700)
  2. Select compatible motherboard (e.g., Intel LGA1700 socket)
  3. Verify compatibility status
- **Expected Result:** Compatibility status shows "Compatible" for matching sockets
- **Priority:** High

#### TC_COMPAT_002: CPU-Motherboard Incompatibility
- **Test Case ID:** TC_COMPAT_002
- **Test Description:** Verify system detects incompatible CPU-motherboard combinations
- **Preconditions:** User has selected CPU and motherboard
- **Test Steps:**
  1. Select Intel CPU (LGA1700)
  2. Select AMD motherboard (AM4 socket)
  3. Verify compatibility status
- **Expected Result:** Compatibility status shows "Incompatible" with warning message
- **Priority:** High

#### TC_COMPAT_003: RAM Compatibility Check
- **Test Case ID:** TC_COMPAT_003
- **Test Description:** Verify RAM type compatibility with motherboard
- **Preconditions:** User has selected motherboard and RAM
- **Test Steps:**
  1. Select DDR4 motherboard
  2. Select DDR4 RAM
  3. Verify compatibility status
- **Expected Result:** RAM compatibility shows "Compatible"
- **Priority:** High

#### TC_COMPAT_004: Power Supply Wattage Check
- **Test Case ID:** TC_COMPAT_004
- **Test Description:** Verify PSU wattage adequacy check
- **Preconditions:** User has selected all major components
- **Test Steps:**
  1. Select high-power components (high-end CPU, GPU)
  2. Select low-wattage PSU (e.g., 300W)
  3. Verify power supply warning
- **Expected Result:** System shows power supply warning for insufficient wattage
- **Priority:** High

#### TC_COMPAT_005: Case Form Factor Check
- **Test Case ID:** TC_COMPAT_005
- **Test Description:** Verify case and motherboard form factor compatibility
- **Preconditions:** User has selected case and motherboard
- **Test Steps:**
  1. Select ATX motherboard
  2. Select ATX case
  3. Verify compatibility status
- **Expected Result:** Case compatibility shows "Compatible"
- **Priority:** Medium

#### TC_COMPAT_006: GPU Length Check
- **Test Case ID:** TC_COMPAT_006
- **Test Description:** Verify GPU length fits in selected case
- **Preconditions:** User has selected case and GPU
- **Test Steps:**
  1. Select long GPU (e.g., RTX 4090)
  2. Select small case
  3. Verify GPU length warning
- **Expected Result:** System shows warning if GPU is too long for case
- **Priority:** Medium

---

### 4. CHAT SUPPORT SYSTEM

#### TC_CHAT_001: Floating Chat Button Visibility
- **Test Case ID:** TC_CHAT_001
- **Test Description:** Verify floating chat button appears for all users
- **Preconditions:** User is on any page
- **Test Steps:**
  1. Navigate to different pages
  2. Verify floating chat button is visible
  3. Check button positioning (bottom-right corner)
- **Expected Result:** Floating chat button is visible on all pages
- **Priority:** High

#### TC_CHAT_002: Chat Window Open/Close
- **Test Case ID:** TC_CHAT_002
- **Test Description:** Verify chat window opens and closes properly
- **Preconditions:** User is on any page
- **Test Steps:**
  1. Click floating chat button
  2. Verify chat window opens
  3. Click close button (X)
  4. Verify chat window closes
- **Expected Result:** Chat window opens and closes smoothly
- **Priority:** High

#### TC_CHAT_003: Guest Chat Functionality
- **Test Case ID:** TC_CHAT_003
- **Test Description:** Verify guest users can use chat support
- **Preconditions:** User is not logged in
- **Test Steps:**
  1. Open chat window as guest
  2. Enter guest name and email
  3. Send a message
  4. Verify message is sent
- **Expected Result:** Guest can send messages successfully
- **Priority:** High

#### TC_CHAT_004: Logged-in User Chat
- **Test Case ID:** TC_CHAT_004
- **Test Description:** Verify logged-in users can use chat support
- **Preconditions:** User is logged in
- **Test Steps:**
  1. Open chat window
  2. Send a message
  3. Verify message appears in chat
  4. Check message history
- **Expected Result:** Logged-in user can send and receive messages
- **Priority:** High

#### TC_CHAT_005: Unread Message Count
- **Test Case ID:** TC_CHAT_005
- **Test Description:** Verify unread message count badge appears
- **Preconditions:** User has unread messages
- **Test Steps:**
  1. Receive a message while chat is closed
  2. Verify red badge with count appears on chat button
  3. Open chat and read message
  4. Verify badge disappears
- **Expected Result:** Unread count badge updates correctly
- **Priority:** Medium

---

### 5. ADMIN DASHBOARD FUNCTIONALITY

#### TC_ADMIN_001: Admin Login
- **Test Case ID:** TC_ADMIN_001
- **Test Description:** Verify admin can login and access admin dashboard
- **Preconditions:** Admin account exists
- **Test Steps:**
  1. Login with admin credentials
  2. Verify redirect to admin dashboard
  3. Check admin sidebar is visible
- **Expected Result:** Admin is redirected to admin dashboard with proper interface
- **Priority:** High

#### TC_ADMIN_002: Component Management
- **Test Case ID:** TC_ADMIN_002
- **Test Description:** Verify admin can manage components
- **Preconditions:** Admin is logged in
- **Test Steps:**
  1. Navigate to inventory management
  2. View component list
  3. Add new component
  4. Edit existing component
  5. Delete component
- **Expected Result:** Admin can perform all CRUD operations on components
- **Priority:** High

#### TC_ADMIN_003: Order Management
- **Test Case ID:** TC_ADMIN_003
- **Test Description:** Verify admin can manage orders
- **Preconditions:** Admin is logged in, orders exist
- **Test Steps:**
  1. Navigate to orders management
  2. View order list
  3. Update order status
  4. View order details
- **Expected Result:** Admin can view and manage orders
- **Priority:** High

#### TC_ADMIN_004: Reports Generation
- **Test Case ID:** TC_ADMIN_004
- **Test Description:** Verify admin can generate reports
- **Preconditions:** Admin is logged in
- **Test Steps:**
  1. Navigate to reports section
  2. Select report type (sales, system, etc.)
  3. Generate report
  4. Verify report data accuracy
- **Expected Result:** Reports are generated with accurate data
- **Priority:** Medium

---

### 6. PREBUILT PC RECOMMENDATIONS

#### TC_PREBUILT_001: Prebuilt PC Display
- **Test Case ID:** TC_PREBUILT_001
- **Test Description:** Verify prebuilt PCs are displayed on home page
- **Preconditions:** User is on home page
- **Test Steps:**
  1. Scroll to prebuilt PC section
  2. Verify prebuilt PCs are displayed
  3. Check PC information (name, price, description)
- **Expected Result:** Prebuilt PCs are displayed with correct information
- **Priority:** High

#### TC_PREBUILT_002: Prebuilt PC Selection
- **Test Case ID:** TC_PREBUILT_002
- **Test Description:** Verify user can select prebuilt PC
- **Preconditions:** User is on home page
- **Test Steps:**
  1. Click on a prebuilt PC
  2. Verify redirect to PC Assembly page
  3. Check components are pre-selected
- **Expected Result:** Prebuilt PC components are loaded in assembly page
- **Priority:** High

#### TC_PREBUILT_003: Prebuilt PC Categories
- **Test Case ID:** TC_PREBUILT_003
- **Test Description:** Verify prebuilt PCs are categorized correctly
- **Preconditions:** User is on home page
- **Test Steps:**
  1. Check different prebuilt PC categories
  2. Verify category icons and labels
  3. Check performance indicators
- **Expected Result:** Categories are displayed correctly with appropriate indicators
- **Priority:** Medium

---

### 7. RESPONSIVE DESIGN & CROSS-BROWSER

#### TC_RESP_001: Mobile Responsiveness
- **Test Case ID:** TC_RESP_001
- **Test Description:** Verify system works on mobile devices
- **Preconditions:** Access system on mobile device or browser dev tools
- **Test Steps:**
  1. Open system on mobile device
  2. Navigate through different pages
  3. Test component selection
  4. Test chat functionality
- **Expected Result:** All features work properly on mobile devices
- **Priority:** High

#### TC_RESP_002: Tablet Responsiveness
- **Test Case ID:** TC_RESP_002
- **Test Description:** Verify system works on tablet devices
- **Preconditions:** Access system on tablet device
- **Test Steps:**
  1. Open system on tablet
  2. Test all major functionalities
  3. Verify layout adapts properly
- **Expected Result:** System adapts well to tablet screen sizes
- **Priority:** Medium

#### TC_RESP_003: Cross-Browser Compatibility
- **Test Case ID:** TC_RESP_003
- **Test Description:** Verify system works across different browsers
- **Preconditions:** Access system on different browsers
- **Test Steps:**
  1. Test on Chrome
  2. Test on Firefox
  3. Test on Safari
  4. Test on Edge
- **Expected Result:** System functions consistently across all browsers
- **Priority:** Medium

---

### 8. ERROR HANDLING & EDGE CASES

#### TC_ERROR_001: Network Error Handling
- **Test Case ID:** TC_ERROR_001
- **Test Description:** Verify system handles network errors gracefully
- **Preconditions:** Simulate network disconnection
- **Test Steps:**
  1. Disconnect network
  2. Try to load components
  3. Try to save build
  4. Reconnect network
- **Expected Result:** Appropriate error messages displayed, system recovers when network restored
- **Priority:** High

#### TC_ERROR_002: Invalid Data Handling
- **Test Case ID:** TC_ERROR_002
- **Test Description:** Verify system handles invalid data gracefully
- **Preconditions:** System is running
- **Test Steps:**
  1. Submit form with invalid data
  2. Try to select non-existent component
  3. Enter invalid search terms
- **Expected Result:** System displays appropriate error messages
- **Priority:** High

#### TC_ERROR_003: Session Timeout
- **Test Case ID:** TC_ERROR_003
- **Test Description:** Verify system handles session timeout
- **Preconditions:** User is logged in
- **Test Steps:**
  1. Wait for session to timeout
  2. Try to perform actions
  3. Verify redirect to login
- **Expected Result:** User is redirected to login page when session expires
- **Priority:** High

---

### 9. PERFORMANCE TESTING

#### TC_PERF_001: Page Load Performance
- **Test Case ID:** TC_PERF_001
- **Test Description:** Verify pages load within acceptable time
- **Preconditions:** System is running
- **Test Steps:**
  1. Measure home page load time
  2. Measure PC Assembly page load time
  3. Measure admin dashboard load time
- **Expected Result:** All pages load within 3 seconds
- **Priority:** Medium

#### TC_PERF_002: Component Loading Performance
- **Test Case ID:** TC_PERF_002
- **Test Description:** Verify component data loads quickly
- **Preconditions:** User is on PC Assembly page
- **Test Steps:**
  1. Switch between component categories
  2. Measure load time for each category
  3. Test search functionality performance
- **Expected Result:** Components load within 2 seconds
- **Priority:** Medium

---

### 10. SECURITY TESTING

#### TC_SEC_001: SQL Injection Prevention
- **Test Case ID:** TC_SEC_001
- **Test Description:** Verify system prevents SQL injection attacks
- **Preconditions:** System is running
- **Test Steps:**
  1. Enter SQL injection attempts in search fields
  2. Try SQL injection in login form
  3. Test component selection with malicious input
- **Expected Result:** System prevents SQL injection and handles input safely
- **Priority:** High

#### TC_SEC_002: XSS Prevention
- **Test Case ID:** TC_SEC_002
- **Test Description:** Verify system prevents XSS attacks
- **Preconditions:** System is running
- **Test Steps:**
  1. Enter script tags in text fields
  2. Try to inject JavaScript in forms
  3. Test chat message input
- **Expected Result:** Scripts are sanitized and not executed
- **Priority:** High

#### TC_SEC_003: Authentication Security
- **Test Case ID:** TC_SEC_003
- **Test Description:** Verify authentication is secure
- **Preconditions:** System is running
- **Test Steps:**
  1. Try to access admin pages without login
  2. Test password strength requirements
  3. Verify token expiration
- **Expected Result:** Unauthorized access is prevented
- **Priority:** High

---

## Test Execution Summary

### Test Environment Setup
- **Browser:** Chrome, Firefox, Safari, Edge
- **Devices:** Desktop, Tablet, Mobile
- **Network:** WiFi, 4G, 3G
- **Database:** MySQL with test data

### Test Data Requirements
- Valid user accounts (regular, admin, employee)
- Sample components in all categories
- Prebuilt PC configurations
- Test orders and builds

### Defect Severity Levels
- **Critical:** System crashes, data loss, security vulnerabilities
- **High:** Major functionality not working, incorrect calculations
- **Medium:** Minor functionality issues, UI problems
- **Low:** Cosmetic issues, minor improvements

### Test Completion Criteria
- All Critical and High priority test cases must pass
- 90% of Medium priority test cases must pass
- 80% of Low priority test cases must pass
- No critical security vulnerabilities
- Performance requirements met

---

## Notes
- Test cases should be executed in a test environment with sample data
- Each test case should be documented with actual results
- Failed test cases should be reported as defects with severity levels
- Test execution should be repeated after each bug fix
- Performance testing should be done with realistic data volumes

---

**Document Version:** 1.0  
**Last Updated:** January 2025  
**Prepared By:** AI Assistant  
**Reviewed By:** [To be filled]
