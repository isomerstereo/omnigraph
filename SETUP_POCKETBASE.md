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
9. **relatedNodeId** (text, optional) - ID of related node (for doubts on existing nodes)
10. **doubtType** (select, optional) - Values: `validity`, `resource`, `connection`

### 4. Create "discussions" Collection (NEW - for forum feature)
Go to Settings > Collections > New Collection

**Collection Name:** `discussions`
**Type:** Base

**Fields to add:**
1. **title** (text, required)
2. **content** (text, required)
3. **authorId** (relation, optional) - Link to users collection
4. **authorName** (text, optional)
5. **category** (select, optional) - Values: `node_proposal`, `general`, `historical_debate`, `source_review`
6. **tags** (text, optional)
7. **votes** (json, optional) - Structure: `{up: [], down: []}`
8. **status** (select, optional) - Values: `active`, `resolved`, `archived`
9. **relatedNodeId** (text, optional) - ID of related node (if applicable)

### 5. Create "comments" Collection (NEW - for forum feature)
Go to Settings > Collections > New Collection

**Collection Name:** `comments`
**Type:** Base

**Fields to add:**
1. **discussionId** (relation, required) - Link to discussions collection
2. **parentId** (text, optional) - ID of parent comment (for threading)
3. **content** (text, required)
4. **authorId** (relation, optional) - Link to users collection
5. **authorName** (text, optional)
6. **votes** (json, optional) - Structure: `{up: [], down: []}`

### 6. API Rules (For Development)
Set these rules to allow authenticated users:

**For all collections (nodes, doubts, discussions, comments):**
- **List rule**: `@request.auth.id != ""`
- **View rule**: `@request.auth.id != ""`
- **Create rule**: `@request.auth.id != ""`
- **Update rule**: `@request.auth.id == @request.data.userId || @request.auth.id == ""`
- **Delete rule**: `@request.auth.id == @request.data.userId || @request.auth.id == ""`

## After Setup
Once collections are created, the app should work immediately with the existing PocketBase integration in App.jsx.
