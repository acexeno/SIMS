# Chat Conversation Isolation Testing Guide

## 🎯 Goal
Verify that each client (guest or registered user) gets their own separate conversation and cannot see or access other clients' conversations.

## ✅ Test Scenarios

### **TEST 1: Guest Users with Same Name but Different Emails**

**Purpose:** Verify that two guests with the same name but different emails get separate conversations.

**Steps:**
1. Open your browser and navigate to the chat support page
2. Clear browser localStorage (F12 → Application → Local Storage → Clear All)
3. Start a chat as Guest 1:
   - Name: `John Doe`
   - Email: `john1@test.com`
   - Send message: `"Hello, I am John from test1"`
   - Note the session ID from the response (check browser console or network tab)

4. Open a NEW browser (or incognito/private window) 
5. Start a chat as Guest 2:
   - Name: `John Doe` (SAME NAME)
   - Email: `john2@test.com` (DIFFERENT EMAIL)
   - Send message: `"Hello, I am John from test2"`
   - Note the session ID

**✅ Expected Result:**
- Guest 1 should get Session ID: X
- Guest 2 should get Session ID: Y (different from X)
- Each guest should only see their own messages
- Messages should NOT be mixed between the two Johns

---

### **TEST 2: Guest Users with Different Names**

**Purpose:** Verify that different guests get separate conversations.

**Steps:**
1. Browser 1 (or clear localStorage):
   - Name: `Alice Smith`
   - Email: `alice@test.com`
   - Send: `"Hi, this is Alice"`

2. Browser 2 (or incognito):
   - Name: `Bob Johnson`
   - Email: `bob@test.com`
   - Send: `"Hi, this is Bob"`

**✅ Expected Result:**
- Alice should see only her messages
- Bob should see only his messages
- They should have different session IDs

---

### **TEST 3: Guest User Reconnection**

**Purpose:** Verify that a guest can reconnect to their own session using the same name+email.

**Steps:**
1. As Guest (John, john@test.com), send a message: `"First message"`
2. Close the browser/tab
3. Reopen and start a new chat with:
   - Name: `John`
   - Email: `john@test.com`
4. Send: `"Second message"`

**✅ Expected Result:**
- Should reconnect to the SAME session
- Should see BOTH "First message" and "Second message"
- Session ID should be the same

---

### **TEST 4: Registered Users**

**Purpose:** Verify that registered users are isolated by their user_id.

**Steps:**
1. Log in as User 1
2. Send a chat message: `"Message from User 1"`
3. Log out
4. Log in as User 2 (different account)
5. Send a chat message: `"Message from User 2"`

**✅ Expected Result:**
- User 1 should only see their own messages
- User 2 should only see their own messages
- Different session IDs based on user_id

---

### **TEST 5: Direct API Testing**

**Purpose:** Test the API directly to verify isolation logic.

#### Test Guest Isolation (Using Browser Console or Postman):

**Test A - Create Session 1:**
```javascript
fetch('http://localhost/capstone2/api/chat.php?send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: null,
    sender: 'user',
    message: 'Test message from guest1',
    guest_name: 'Test User',
    guest_email: 'test1@example.com',
    user_id: null
  })
})
.then(r => r.json())
.then(data => {
  console.log('Session 1 ID:', data.session_id);
  window.session1 = data.session_id;
});
```

**Test B - Create Session 2 (Same name, different email):**
```javascript
fetch('http://localhost/capstone2/api/chat.php?send', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    session_id: null,
    sender: 'user',
    message: 'Test message from guest2',
    guest_name: 'Test User',  // SAME NAME
    guest_email: 'test2@example.com',  // DIFFERENT EMAIL
    user_id: null
  })
})
.then(r => r.json())
.then(data => {
  console.log('Session 2 ID:', data.session_id);
  window.session2 = data.session_id;
});
```

**✅ Expected Result:**
- `session1` should be different from `session2`
- If they were the same, isolation is broken

**Test C - Try to access Session 1 with Session 2 credentials:**
```javascript
fetch(`http://localhost/capstone2/api/chat.php?messages&session_id=${window.session1}&guest_name=Test User&guest_email=test2@example.com`)
.then(r => r.json())
.then(data => {
  console.log('Access result:', data);
  // Should return empty messages or error because email doesn't match
});
```

**✅ Expected Result:**
- Should NOT return messages from session1
- Should return empty messages array or error

---

## 🔍 Database Verification

Check the database directly to verify sessions are separate:

```sql
-- View all chat sessions
SELECT id, user_id, guest_name, guest_email, status, created_at 
FROM chat_sessions 
ORDER BY created_at DESC 
LIMIT 10;

-- View messages for a specific session
SELECT id, session_id, sender, message, sent_at 
FROM chat_messages 
WHERE session_id = [SESSION_ID]
ORDER BY sent_at ASC;

-- Count sessions per guest (should be separate)
SELECT guest_name, guest_email, COUNT(*) as session_count 
FROM chat_sessions 
WHERE user_id IS NULL 
GROUP BY guest_name, guest_email;
```

**✅ Expected Result:**
- Different session IDs for different clients
- Messages only in their respective session_ids
- No shared sessions between different guests

---

## 🚨 What to Look For (Red Flags)

❌ **FAILED TESTS - If you see:**
- Same session ID for different guests with same name but different emails
- Messages from one guest appearing in another guest's chat
- Ability to access another guest's messages by changing only the email
- Sessions being shared between different registered users

✅ **PASSED TESTS - If you see:**
- Different session IDs for different clients
- Each client only sees their own messages
- Cannot access other clients' messages
- Proper session reconnection for returning guests (same name+email)

---

## 📝 Quick Test Checklist

- [ ] Guest 1 (John, john1@test.com) creates Session A
- [ ] Guest 2 (John, john2@test.com) creates Session B (different from A)
- [ ] Guest 1 can only see their own messages
- [ ] Guest 2 can only see their own messages
- [ ] Guest 1 cannot access Guest 2's session
- [ ] Registered User 1 has separate session
- [ ] Registered User 2 has separate session
- [ ] Database shows separate session IDs
- [ ] Messages are correctly associated with their sessions

---

## 🛠️ Testing Tools

### Browser Console Testing:
Open browser DevTools (F12) → Console tab, then run the test scripts above.

### Database Tool:
Use phpMyAdmin or MySQL command line to verify sessions and messages.

### Network Tab:
Check browser DevTools → Network tab to see session IDs in API responses.

---

## 📞 Need Help?

If tests fail:
1. Check the browser console for errors
2. Verify the chat.php file was updated correctly
3. Check database for session records
4. Clear browser cache and localStorage
5. Review server logs for errors


