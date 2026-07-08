# PocketBase Setup Instructions

## Server Status
✅ PocketBase server is running at http://127.0.0.1:8090
✅ Superuser created: admin@omnigraph.local / admin123

## Manual Collection Setup

Since the API requires authentication, please set up the collections manually through the admin UI:

### 1. Access Admin UI
Open http://127.0.0.1:8090/_/ in your browser
Login with: admin@omnigraph.local / admin123

### 2. Create "nodes" Collection
Go to Settings > Collections > New Collection

**Collection Name:** `nodes`
**Type:** Base

**Fields to add:**
1. **title** (text, required)
2. **nodeType** (select, required) - Values: `event`, `era`
3. **time** (text, required)
4. **endTime** (text, optional)
5. **era** (select, required) - Values: `AD`, `BC`, `MYA`, `GYA`
6. **actualYear** (number, required)
7. **actualEndYear** (number, optional)
8. **tags** (text, optional)
9. **icon** (text, optional)
10. **content** (text, optional)
11. **citation** (text, optional)
12. **videoLink** (url, optional)
13. **image** (url, optional)
14. **userId** (relation, optional) - Link to users collection

### 3. Create "doubts" Collection
Go to Settings > Collections > New Collection

**Collection Name:** `doubts`
**Type:** Base

**Fields to add:**
1. **title** (text, required)
2. **content** (text, optional)
3. **suggestedTime** (text, optional)
4. **suggestedEra** (select, optional) - Values: `AD`, `BC`, `MYA`, `GYA`
5. **authorId** (relation, optional) - Link to users collection
6. **authorName** (text, optional)
7. **votes** (json, optional)
8. **status** (select, optional) - Values: `pending`, `approved`, `rejected`

### 4. API Rules (Optional)
For development, you can leave API rules as null (public access).
For production, set appropriate rules based on your security requirements.

## After Setup
Once collections are created, the app should work immediately with the existing PocketBase integration in App.jsx.
