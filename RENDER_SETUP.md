# Render Deployment Setup Guide

## Required Environment Variables

The application requires these environment variables to be set on Render:

### 1. **MONGODB_URI** (REQUIRED)
MongoDB Atlas connection string

```
mongodb+srv://USERNAME:PASSWORD@CLUSTER.mongodb.net/foodshare?retryWrites=true&w=majority
```

**Steps to get your MongoDB URI:**
1. Go to https://cloud.mongodb.com
2. Select your FoodShare cluster
3. Click **Connect** button
4. Choose "Drivers" → "Node.js"
5. Copy the connection string
6. Replace `<password>` with your MongoDB password
7. Ensure database name is `foodshare`

### 2. **JWT_SECRET** (REQUIRED)
Secret key for JWT token signing

```
your-secure-random-string-here
```

### 3. **GMAIL_EMAIL** (OPTIONAL)
Gmail address for sending emails (if using Gmail SMTP)

```
your_email@gmail.com
```

### 4. **GMAIL_PASSWORD** (OPTIONAL)
Gmail app password (if using Gmail SMTP)

```
your-app-specific-password
```

## How to Set Environment Variables on Render

1. Go to https://dashboard.render.com
2. Select the **project-food** service
3. Click **Settings** → **Environment**
4. Add each variable:
   - Click **Add Environment Variable**
   - Enter **Name** (e.g., `MONGODB_URI`)
   - Enter **Value** (your connection string)
   - Click **Save**
5. Render will automatically redeploy after changes

## Verification

After setting MONGODB_URI:
1. Render will automatically start a new deployment
2. Check the **Logs** tab for deployment status
3. Look for "Server is running" message
4. Application should be accessible at https://project-food-1-1-render.com

## Troubleshooting

**Error: "MONGODB_URI environment variable is required"**
- Confirm MONGODB_URI is set in Render environment variables
- Check the variable name spelling exactly: `MONGODB_URI`
- Restart the service after setting the variable

**Error: "Connection timeout"**
- Verify MongoDB Atlas allows connections from Render IPs
- Check MongoDB Atlas IP whitelist includes `0.0.0.0/0` (all IPs)
- Test connection string locally first with: `mongo "YOUR_CONNECTION_STRING"`

**Error: "Failed to connect to MongoDB"**
- Confirm password doesn't contain special characters that need URL encoding
- Test connection string format is correct
- Verify database name in connection string matches MongoDB database
