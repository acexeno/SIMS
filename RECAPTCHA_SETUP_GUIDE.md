# reCAPTCHA Setup Guide

This guide explains how to set up and configure Google reCAPTCHA v3 for your SIMS system.

## Overview

reCAPTCHA has been implemented across all user levels and forms:
- **Login** (password and OTP modes)
- **Registration**
- **Contact/Feedback form**
- **OTP Verification**

## Prerequisites

1. A Google account
2. Access to your domain's DNS settings (for domain verification)
3. Environment variable configuration access

## Step 1: Get reCAPTCHA Keys from Google

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Click **"Create"** or **"Add"** to create a new site
3. Fill in the form:
   - **Label**: Enter a name (e.g., "SIMS - BuildItPC")
   - **reCAPTCHA type**: Select **reCAPTCHA v3**
   - **Domains**: Add your domain(s):
     - For local development: `localhost`, `127.0.0.1`
     - For production: `yourdomain.com`, `www.yourdomain.com`
   - Accept the reCAPTCHA Terms of Service
4. Click **"Submit"**
5. **Copy your Site Key and Secret Key** - You'll need both

## Step 2: Configure Frontend (Site Key)

### Option A: Environment Variable (Recommended)

1. Create or edit `.env` file in the project root (if using Vite):
   ```
   VITE_RECAPTCHA_SITE_KEY=your_site_key_here
   ```

2. Or set it in `vite.config.js` if you prefer:
   ```javascript
   define: {
     'RECAPTCHA_SITE_KEY': JSON.stringify('your_site_key_here')
   }
   ```

### Option B: Window Variable (Alternative)

If you prefer, you can set it in `index.html`:
```html
<script>
  window.RECAPTCHA_SITE_KEY = 'your_site_key_here';
</script>
```

## Step 3: Configure Backend (Secret Key)

1. Add the secret key to your environment configuration:

### For Local Development

Edit `backend/config/local.env`:
```env
RECAPTCHA_SECRET_KEY=your_secret_key_here
RECAPTCHA_MIN_SCORE=0.5
```

### For Production

Edit `backend/config/production.env` or your `.env` file:
```env
RECAPTCHA_SECRET_KEY=your_secret_key_here
RECAPTCHA_MIN_SCORE=0.5
```

## Step 4: Environment Variables Reference

| Variable | Description | Default | Required |
|----------|-------------|---------|----------|
| `VITE_RECAPTCHA_SITE_KEY` | Frontend site key | - | Yes |
| `RECAPTCHA_SECRET_KEY` | Backend secret key | - | Yes |
| `RECAPTCHA_MIN_SCORE` | Minimum score threshold (0.0-1.0) | 0.5 | No |

### About the Score Threshold

reCAPTCHA v3 returns a score from 0.0 to 1.0:
- **1.0**: Very likely a legitimate user
- **0.5-0.9**: Likely a legitimate user
- **0.1-0.4**: Suspicious activity
- **0.0**: Very likely a bot

**Recommended**: Start with 0.5 and adjust based on your needs:
- Lower (0.3): Fewer false positives, but may allow some bots
- Higher (0.7): Stricter, but may block legitimate users

## Step 5: Test the Implementation

### Testing Checklist

1. **Login Form**:
   - Try logging in with valid credentials
   - Check browser console for reCAPTCHA errors
   - Verify form submission works

2. **Registration Form**:
   - Try creating a new account
   - Verify reCAPTCHA token is generated
   - Check backend logs for verification

3. **Contact Form**:
   - Submit a feedback message
   - Verify it goes through successfully

4. **OTP Verification**:
   - Request OTP code
   - Verify code - should work with reCAPTCHA

## Step 6: Monitoring and Troubleshooting

### Check if reCAPTCHA is Loaded

Open browser console (F12) and run:
```javascript
console.log('grecaptcha:', window.grecaptcha);
console.log('Site Key:', window.RECAPTCHA_SITE_KEY || import.meta.env.VITE_RECAPTCHA_SITE_KEY);
```

### Common Issues

1. **"reCAPTCHA is not configured" warning**
   - Solution: Ensure `VITE_RECAPTCHA_SITE_KEY` is set correctly
   - Restart your dev server if using Vite

2. **"Invalid site key" error**
   - Solution: Verify the site key matches your domain
   - Check that you've added your domain in Google reCAPTCHA console

3. **Backend verification fails**
   - Solution: Check that `RECAPTCHA_SECRET_KEY` is set correctly
   - Verify the secret key matches the site key

4. **Requests fail with 403**
   - Solution: Check backend logs for reCAPTCHA verification errors
   - Verify the score threshold isn't too high
   - Check that tokens are being sent in requests

### Backend Logs

Check PHP error logs for reCAPTCHA-related messages:
- Successful verification: No errors
- Failed verification: Error logged with details
- Connection issues: "Unable to connect to Google API"

## Graceful Degradation

The implementation includes **graceful degradation**:
- If reCAPTCHA is not configured, the system continues to work
- If reCAPTCHA fails to load, forms still function (with a warning)
- If verification fails on the backend, requests are still processed (unless configured to be strict)

To enforce strict reCAPTCHA (recommended for production):

1. Remove the graceful degradation checks in `backend/utils/recaptcha_helper.php`
2. Make reCAPTCHA verification required in your endpoints

## Security Best Practices

1. **Never expose your Secret Key**:
   - Keep it in environment variables only
   - Never commit it to version control
   - Add `.env` to `.gitignore`

2. **Use Different Keys for Development and Production**:
   - Create separate reCAPTCHA sites for each environment
   - Use different keys per environment

3. **Monitor reCAPTCHA Analytics**:
   - Check Google reCAPTCHA console regularly
   - Monitor for unusual patterns
   - Adjust score threshold based on analytics

4. **Regular Key Rotation**:
   - Periodically rotate your keys
   - Update keys in production carefully

## File Locations

### Frontend
- `src/utils/recaptcha.js` - reCAPTCHA utility functions
- `src/components/common/Recaptcha.jsx` - React component wrapper
- `src/components/auth/Login.jsx` - Login form with reCAPTCHA
- `src/components/auth/Register.jsx` - Registration form with reCAPTCHA
- `src/pages/Contact.jsx` - Contact form with reCAPTCHA

### Backend
- `backend/utils/recaptcha_helper.php` - PHP verification functions
- `backend/api/auth.php` - Login/Register endpoints with verification
- `backend/api/otp.php` - OTP verification endpoint
- `backend/api/submit_feedback.php` - Contact form endpoint

## Additional Resources

- [Google reCAPTCHA v3 Documentation](https://developers.google.com/recaptcha/docs/v3)
- [reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
- [reCAPTCHA Best Practices](https://developers.google.com/recaptcha/docs/v3)

## Support

If you encounter issues:
1. Check the troubleshooting section above
2. Review browser console and server logs
3. Verify environment variables are set correctly
4. Test with reCAPTCHA debug mode (if available)

---

**Note**: This implementation uses reCAPTCHA v3, which works invisibly in the background. Users won't see a checkbox or challenge - verification happens automatically.

