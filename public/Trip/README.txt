TRIP OPTIMIZER (8Z-RP)
=======================

Files:
1. index.html   (Main Interface)
2. style.css    (Dark Mode Styling)
3. app.js       (Application Logic + Google Maps Handler)
4. worker.js    (Route Optimization Solver - runs in background)

Installation:
1. Open 'index.html' in a text editor.
2. Scroll to the bottom and find "YOUR_API_KEY_HERE".
3. Replace it with your valid Google Maps API Key.
4. Upload all 4 files to your web server (e.g., public_html/trip/).

Usage:
- Enter locations in the left panel.
- Click "Optimize".
- The map on the right will automatically draw the best route.
- Use "Open in Maps" links to send the route to your phone app.

Notes:
- Requires an active Google Cloud Project with "Maps JavaScript API" enabled.
- Ensure your API key has "Website Restrictions" set to your domain to prevent theft.