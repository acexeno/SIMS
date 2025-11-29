# Fix reCAPTCHA Configuration Issue

## Problem
After rebuilding the project, the reCAPTCHA site key is missing because Vite environment variables are embedded at build time. The warning `[Login] reCAPTCHA is NOT configured` appears in the console.

## Solution

### Step 1: Get Your reCAPTCHA Site Key

1. Go to [Google reCAPTCHA Admin Console](https://www.google.com/recaptcha/admin)
2. Find your site (the one with secret key: `6LfVeQAsAAAAAFzZH2eZ9CW3aIagVvnm3A_gQzuv`)
3. Copy the **Site Key** (it should start with `6Lf...` and be different from the secret key)

### Step 2: Update index.html

1. Open `HOSTINGER SYSTEM/index.html` in a text editor
2. Find this line:
   ```html
   window.RECAPTCHA_SITE_KEY = 'YOUR_RECAPTCHA_SITE_KEY_HERE';
   ```
3. Replace `YOUR_RECAPTCHA_SITE_KEY_HERE` with your actual site key:
   ```html
   window.RECAPTCHA_SITE_KEY = '6LfXXXXXXXXXXXXX';  <!-- Your actual site key -->
   ```

### Step 3: Upload to Hostinger

1. Upload the updated `index.html` file to `/public_html/` on your Hostinger server
2. The reCAPTCHA should now work correctly

## Alternative: Set Environment Variable Before Building

If you prefer to use environment variables:

1. Create a `.env` file in the project root:
   ```
   VITE_RECAPTCHA_SITE_KEY=your_site_key_here
   ```

2. Rebuild the project:
   ```bash
   npm run build
   ```

3. Upload the new build files

## Verification

After uploading, check the browser console. You should see:
- `[reCAPTCHA] Configuration check:` with the site key visible
- No more warnings about reCAPTCHA not being configured
- The reCAPTCHA widget should appear on the login page

