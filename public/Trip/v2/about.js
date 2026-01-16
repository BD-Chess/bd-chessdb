/* ABOUT PAGE CONTENT
   ------------------
   The "Why" and "Vision" of 8Z-RP.
*/

window.ABOUT_CONTENT = `
  <div class="card help-block">
    <h2>The Origin Story</h2>
    <p><strong>From Sahara to Sea</strong><br>
    The idea for 8Z-RP was born during an 8-day expedition across Morocco—from the dunes of the Sahara to the Atlantic coast. It was the trip of a lifetime, but the logistics were a nightmare. I found myself juggling WhatsApp tips, Google Maps, and messy notes, manually trying to connect 20 scattered locations into a logical path.</p>
    <p>I realized that while Google Maps is great for <em>navigation</em> (getting from A to B), it is terrible at <em>logistics</em> (ordering 20 stops efficiently). I built 8Z-RP to be the "All-in-One" cockpit I wish I had in the Medina of Marrakech.</p>
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

  <div style="margin-top: 30px; padding-top: 20px; border-top: 1px solid var(--border); font-size: 0.9rem; color: var(--text-dim); text-align: center; line-height: 1.6; margin-bottom: 20px;">
    <strong>Author & Concepts:</strong> Bojan Dobrečevič<br>
    <strong>Built with:</strong> Gemini, GPT, and Claude<br>
    Jan 2026
  </div>

  <div style="opacity: 0.8;">
    <details style="cursor:pointer; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border: 1px solid var(--border);">
      <summary style="font-weight:700; color:var(--primary); font-size: 0.85rem; text-transform: uppercase; letter-spacing: 1px;">⚙️ Architecture (Technical Deep Dive)</summary>
      
      <div style="margin-top:15px; padding-left:10px; border-left:2px solid var(--primary); font-size: 0.9rem; line-height: 1.5;">
        <p><strong>The "8Z" Insight: Routing as Compression</strong><br>
        This engine is built on a novel hypothesis: <em>"The shortest physical route is simply the most mathematically compressed representation of a dataset."</em></p>
        
        <p><strong>Under the Hood:</strong></p>
        <ul style="margin-top:5px;">
          <li style="margin-bottom:8px;"><strong>Deterministic Swarm Intelligence:</strong> Unlike standard genetic algorithms that rely on chaos, 8Z-RP uses a custom <em>Seeded XorShift64*</em> generator. This allows us to spawn 2,000+ virtual "agents" that explore route permutations in parallel but converge on the exact same result every time.</li>
          
          <li style="margin-bottom:8px;"><strong>MDL Optimization:</strong> We apply principles from <em>Minimum Description Length</em> theory (usually used in data compression) to the Traveling Salesperson Problem (TSP). The engine penalizes "entropy" (distance and complexity) to find the signal in the noise.</li>
          
          <li><strong>Client-Side Compute:</strong> By porting this logic to optimized JavaScript Workers, we achieve server-grade calculation speeds (checking ~100,000 permutations/sec) directly on your device, ensuring zero data leakage.</li>
        </ul>
      </div>
    </details>
  </div>
`;
