# AlgoRitual ⚡

Automate & Schedule your DSA preparation. Build customized plans, track progress, review problems in the Spaced Repetition Revision Vault, and keep your LeetCode streak burning.

---

## 📁 Project Structure

```text
AlgoRitual/
├── backend/            # Express.js Server
│   ├── app.js          # App configurations & API routes
│   ├── server.js       # Entry point for backend server
│   ├── models/         # Mongoose models (User, Plan, Problem)
│   ├── routes/         # Express routes (auth, dsa)
│   └── package.json    # Backend dependencies & scripts
├── frontend/           # Static Frontend (HTML, CSS, JS)
│   ├── index.html      # Main Single Page App (SPA) view
│   ├── css/            # Style sheets (custom CSS design system)
│   └── js/             # Frontend logic (interactive client)
└── README.md           # Deployment & documentation guide
```

---

## 💻 Local Development Setup

To run AlgoRitual locally:

1. **Clone the repository** (if not already done).
2. **Setup backend environment**:
   Create a `.env` file inside the `backend` folder:
   ```env
   PORT=5001
   MONGODB_URI=your_mongodb_atlas_connection_string
   JWT_SECRET=your_jwt_secret_token
   ```
3. **Install dependencies**:
   ```bash
   cd backend
   npm install
   ```
4. **Start the development server**:
   ```bash
   npm run dev
   ```
5. **Open in browser**:
   Navigate to `http://localhost:5001` to use the application.

---

## 🚀 Deployment on Render

If your deployed website on Render looks unstyled or shows raw HTML text, it is because Render is only deploying the `backend` folder and cannot find the sibling `frontend` folder. Follow these steps to configure your deployment correctly:

### 1. Update Render Service Settings
Go to the **Render Dashboard**, select your web service, and navigate to **Settings**:

| Field | Configuration Value |
| :--- | :--- |
| **Root Directory** | *(Leave blank/empty)* ⚠️ **CRITICAL: Do not write `backend` here** |
| **Build Command** | `npm install --prefix backend` |
| **Start Command** | `npm start --prefix backend` |

> [!IMPORTANT]
> By keeping **Root Directory** empty (the repository root), Render will download both the `backend` and `frontend` folders into the production container. The Express server will then successfully find and serve the frontend assets.

### 2. Configure Environment Variables
Navigate to **Environment** in the Render sidebar and add the following variables:

- `MONGODB_URI`: Your MongoDB Atlas connection string (e.g., `mongodb+srv://...`)
- `JWT_SECRET`: A secure random string for JWT token generation.
- `PORT`: `10000` (or leave empty, Render automatically configures `PORT`).
