---
description: Deploy the application to GitHub Pages
---

1. Bump the version number in `package.json` (e.g. `2.5.1` -> `2.6.0`).
2. Update `vite.config.js` or application code if needed (usually automatic if using `import.meta.env`).
3. Commit all changes with a descriptive message including the version number.
   ```bash
   git add .
   git commit -m "chore(release): bump version to x.y.z and [feature description]"
   ```
4. Push to the GitHub repository.
   ```bash
   git push v2 main
   ```
5. Confirm deployment by checking the GitHub Actions tab or waiting for the live site title to update.
