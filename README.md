# UBP Production Scheduler v2

A React-based Manufacturing Resource Planning (MRP) and Production Scheduling dashboard tailored for Beverage Co-Packers.

## 🚀 Features
*   **MRP Engine**: Calculates material needs based on demand, inventory, and lead times.
*   **Production Scheduler**: Drag-and-drop interface for planning production runs.
*   **Procurement**: Manage Purchase Orders (POs) and track inbound supply.
*   **Role-Based Access**: Granular permissions for Admin, Planner, Logistics, and Viewer.

## 🛠 Tech Stack
*   **Frontend**: React 18, Vite, Tailwind CSS
*   **Backend**: Supabase (PostgreSQL, Auth, Edge Functions)
*   **State Management**: React Context + Custom Hooks
*   **Testing**: Vitest, React Testing Library

## 🚦 Getting Started

### Prerequisites
*   Node.js (v18+)
*   Supabase Account

### Installation
1.  Clone the repository:
    ```bash
    git clone https://github.com/ebalazy/UBP-Scheduler-V2.git
    cd UBP-Scheduler-V2
    ```
2.  Install dependencies:
    ```bash
    npm install
    ```

### Configuration
Create a `.env` file in the root directory:
```env
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_ANON_KEY=your_supabase_anon_key
```

### Running Locally
```bash
npm run dev
```
Open `http://localhost:5173` in your browser.

## 🧪 Testing
Run the unit test suite (focuses on MRP logic):
```bash
npm test
```

## 📦 Deployment
See [DEPLOYMENT.md](./DEPLOYMENT.md) for build and deploy instructions.

## 🔒 Security
*   **RLS**: Row Level Security is enabled. Run `src/supabase/migrations/20251216_secure_procurement_rls.sql` in your Supabase SQL Editor.
*   **Auth**: Users are assigned roles (`admin`, `planner`, `viewer`) in the `user_roles` table.

## 📂 Project Structure
*   `src/components`: UI widgets and views.
*   `src/services`: Database interaction layer.
*   `src/utils`: Pure business logic (e.g., `mrpLogic.js`).
*   `src/types`: JSDoc definitions and Zod schemas.
