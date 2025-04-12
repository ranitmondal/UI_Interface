# Playwright Test Dashboard (UI + API)

## 🧪 What is this?

A simple web interface where team members (like BAs) can run Playwright automated tests via a user-friendly dashboard.

---

## 🚀 Getting Started

### 1. Install Dependencies

```bash
npm install
```

### 2. Install Playwright Browsers

```bash
npx playwright install
```

### 3. Run the App

```bash
npm run dev
```

This will start the Next.js server at [http://localhost:3000](http://localhost:3000)

---

## 🧪 Run All Tests via CLI (Optional)

```bash
npm run test
```

---

## 📂 Folder Structure

```
Interface/
├── UI/
│   └── pages/
│       ├── index.tsx         # Frontend UI
│       └── api/
│           ├── run-test.ts   # API to run test
│           └── list-tests.ts # API to fetch test files
├── tests/
│   └── sample.spec.ts        # Example test file
├── package.json
└── README.md
```

---

## ✅ Notes

- All `.spec.ts` or `.spec.js` files inside `Interface/tests/` are automatically listed on the dashboard.
- Test output is currently printed to the console (future: logs in UI).
