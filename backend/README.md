Backrank Chess API — Phase 2 MongoDB Backend
This is the Phase 2 backend for Backrank Chess:

Node.js
Express
MongoDB Atlas
Mongoose
JWT auth
bcrypt password hashing
1. Install
Bash

cd phase2-mongodb-backend
npm install
2. Create .env
Copy .env.example to .env:

Bash

copy .env.example .env
PowerShell alternative:

PowerShell

Copy-Item .env.example .env
Mac/Linux:

Bash

cp .env.example .env
3. Fill .env
You need a MongoDB Atlas connection string:

env

PORT=3000
MONGODB_URI=mongodb+srv://YOUR_USERNAME:YOUR_PASSWORD@YOUR_CLUSTER.mongodb.net/backrank_chess?retryWrites=true&w=majority
JWT_SECRET=make-this-a-long-random-secret
CLIENT_ORIGIN=http://localhost:5500,http://127.0.0.1:5500,https://rajat4409d-cpu.github.io
4. Run locally
Bash

npm run dev
Then visit:

text

http://localhost:3000/api/health
Expected result:

JSON

{ "ok": true, "app": "Backrank Chess API", "db": "MongoDB" }
API routes
Auth
text

POST /api/auth/register
POST /api/auth/login
GET  /api/auth/me
Profile
text

GET /api/profile
PUT /api/profile/stats
Games
text

POST /api/games
GET  /api/games
Phase 3 later
Deploy this backend to Render or Railway, then point the frontend auth.js API URL to your deployed backend URL.