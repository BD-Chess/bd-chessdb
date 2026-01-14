/* ABOUT PAGE CONTENT
   ------------------
   The "Why" and "Vision" of 8Z-RP.
*/

window.ABOUT_CONTENT = `
  <div class="card help-block">
    <h2>The Origin Story</h2>
    
    <p><strong>From Sahara to Sea</strong><br>
    The idea for 8Z-RP was born during an 8-day expedition across Morocco—from the dunes of the Sahara to the Atlantic coast. It was the trip of a lifetime, but the logistics were a nightmare. I found myself juggling WhatsApp tips, Google Maps, and messy notes, manually trying to connect 20 scattered locations into a logical path.</p>
    
    <p><strong>The "8Z" Insight</strong><br>
    I realized that <strong>route optimization is actually a data compression problem.</strong></p>
    
    <p>I had already developed <em>8Z Compression</em> to reduce data to its mathematical minimum. I applied that same logic here: the shortest route is simply the most "compressed" version of a trip. Working with AI, I built this engine to solve that problem instantly.</p>
  </div>

  <div class="card help-block">
    <h2>The Vision: A Traveler's Cockpit</h2>
    <p>I wanted a single tool that does it all. No more switching apps. You dump your chaotic list of stops into 8Z-RP, and it hands you back a mathematically perfect plan.</p>
    <p>This is the only tool I need for my next adventure, and I believe it's what every serious traveler needs.</p>
  </div>

  <div class="card help-block">
    <h2>Core Philosophy</h2>
    <ul>
      <li><strong>🛡️ Privacy First:</strong> 8Z-RP runs 100% Client-Side. Your trip data lives in your browser. It never touches a database.</li>
      <li><strong>🎯 True Determinism:</strong> Unlike random solvers, we use a seeded algorithm. <strong>Same Input ⇒ Exact Same Route.</strong> Every time.</li>
      <li><strong>⚡ Efficiency:</strong> We save you time, fuel, and energy by calculating the absolute shortest path.</li>
    </ul>
    
    <p style="margin-top:15px; border-left: 3px solid var(--primary); padding-left: 10px; color: var(--text-dim); font-style: italic;">
      "Gemini AI confirms: There are no complete, private, client-side tools like this one on the market."
    </p>
  </div>

  <div style="text-align: center; margin: 25px 0;">
    <button class="btn-neutral" style="width: auto; font-size: 0.85rem; padding: 8px 16px;" onclick="document.getElementById('techStory').style.display='block'; this.style.display='none'">
      ⚙️ Learn More: The Technical Origin
    </button>
  </div>

  <div id="techStory" class="card help-block" style="display: none; border-left: 3px solid var(--primary); background: rgba(59, 130, 246, 0.05);">
    <h2>Deep Dive: The 8Z Architecture</h2>
    
    <p><strong>What is "8Z Compression"?</strong><br>
    8Z is a research framework I developed that stores <em>mathematical models</em> instead of raw bytes. Instead of just shrinking a file, it searches for the shortest mathematical formula that can reproduce the data bit-for-bit. We call this "Algorithmic Information Theory" in practice.</p>

    <p><strong>The Connection to Maps</strong><br>
    We realized that <strong>Route Optimization</strong> is the exact same mathematical problem. A "perfect route" is simply the shortest mathematical program that connects a set of points. We didn't just borrow the name; we ported the engine.</p>

    <p><strong>Shared DNA</strong><br>
    This tool runs on the same "Physics Engine" as the compressor:</p>
    <ul>
      <li><strong>Deterministic Seeding:</strong> We use the <code>fnv1a64</code> hash to turn your trip inputs into a unique mathematical seed. This ensures that <em>Input A</em> always yields <em>Result B</em>.</li>
      <li><strong>The Generator:</strong> The <code>XorShift64Star</code> algorithm—originally built to generate texture data for image compression—is used here to "scramble" and refine route segments.</li>
      <li><strong>The Atlas:</strong> Just as the compressor stores discovered formulas in an "Atlas," 8Z-RP caches your optimized routes in a local database so they never need to be solved twice.</li>
    </ul>
  </div>

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--text-dim); text-align: center; line-height: 1.6;">
    <strong>Author & Concepts:</strong> Bojan Dobrečevič<br>
    <strong>Built with:</strong> Gemini, GPT, and Claude<br>
    Jan 2026
  </div>
`;
