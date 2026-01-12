/* HELP / GUIDE CONTENT
   --------------------
   Instructions on how to use the app.
*/

window.HELP_CONTENT = `
  <div class="card help-block">
    <h2>How to Use</h2>
    <ul>
      <li><strong>1. Trip Library:</strong> Click [+] to expand continents. Click a tour name to load it.</li>
      <li><strong>2. Edit:</strong> Add or remove stops in the text box.</li>
      <li><strong>3. Optimize:</strong> Use "Standard" for fast results or "Deep Search" for complex routes.</li>
      <li><strong>4. Export:</strong> Click the "Open in Maps" links to send the route to your phone.</li>
    </ul>
  </div>

  <div class="card help-block">
    <h2>Understanding Stats</h2>
    <ul>
      <li><strong>Distance:</strong> The total length of the optimized route shown on the map.</li>
      <li><strong>Saved:</strong> The distance you avoided traveling by using this tool. <br>
      <em>Calculation: (Distance of your original order) - (Optimized Distance)</em>.</li>
    </ul>
  </div>

  <div class="card help-block">
    <h2>Input Formats</h2>
    <p class="muted">You can mix and match these formats.</p>
    <h3>1. GPS Coordinates (Recommended)</h3>
    <pre>46.0569, 14.5058</pre>
    <h3>2. Addresses / Place Names</h3>
    <pre>Tivoli Park, Ljubljana</pre>
    <h3>3. Custom Name with GPS</h3>
    <pre>Home | 46.0428, 14.4500</pre>
  </div>

  <div class="card help-block">
    <h2>Special Commands</h2>
    <h3>Locking the Start</h3>
    <p>Add <code>START</code> anywhere on a line to lock it as the starting point.</p>
    <pre>Grand Hotel Union | 46.0525, 14.5060 START</pre>
  </div>
`;