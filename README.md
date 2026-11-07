# Tillora phone browser beta

This is a browser prototype, not an APK. Receipt recognition uses Tesseract.js from a third-party CDN, so internet access is needed to load the recognition components. Receipt recognition and total extraction are experimental and must be verified before saving. No account or payment required.

## Publish with GitHub Pages

1. On GitHub, create a new **public** repository (for example, `tillora-beta`).
2. Upload `index.html`, `logic.js`, `privacy.html`, and the `.github/workflows/pages.yml` file into the repository, preserving the folder path. The GitHub mobile website may make uploading folders difficult; using a GitHub-compatible editor or GitHub's web interface with desktop site enabled may help.
3. Go to repository **Settings > Pages > Build and deployment > Source**, choose **GitHub Actions**.
4. The workflow deploys the files. The address should follow `https://YOUR-USERNAME.github.io/tillora-beta/` if that is your repository name; verify the actual address under Pages settings.
5. Open the HTTPS URL on Samsung Internet or Chrome. Select a receipt photo; OCR starts automatically. Confirm the recognised total and other fields before saving.

### Privacy and limitations

Public GitHub repository source is visible to everyone; do not upload real receipts or financial data. Transaction records remain in the browser's local storage and can be lost if browser storage is cleared. Backups are unencrypted JSON. The CDN and network can fail. Do not treat OCR as verified accurate. This prototype is not a compiled Android application.
