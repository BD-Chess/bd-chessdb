/* ABOUT PAGE CONTENT
   ------------------
   The "Why" and "Vision" of 8Z-RP.
*/

window.ABOUT_CONTENT = `
  <div class="card help-block">
    <h2>The Origin Story</h2>
    <p><strong>The "Marrakech" Moment</strong><br>
    The idea for 8Z-RP was born last year in the chaos of a trip to Morocco. I found myself standing in the middle of a busy Medina, juggling three different apps: an AI chatbot to find "hidden gems," Google Maps to figure out where they were, and a Notes app to keep track of the order. My battery was dying, and the logistics were a mess.</p>
    <p>I realized something: <strong>AI is great at dreaming, but bad at logistics. Maps are great at navigation, but bad at planning.</strong></p>
    <p>I built 8Z-RP to bridge that gap. I wanted a single, private, high-performance tool where I could dump a list of places and get a mathematically perfect route instantly.</p>
  </div>

  <div class="card help-block">
    <h2>Core Philosophy</h2>
    <ul>
      <li><strong>🛡️ Privacy First:</strong> In an era of data tracking, 8Z-RP is a rebellion. It runs 100% Client-Side. Your trip data lives in your browser's local memory. It never touches a database. I don't see your trips, and I don't want to.</li>
      
      <li><strong>🎯 True Determinism:</strong> Most online route solvers are "randomized"—if you click optimize twice, you might get different results. That drove me crazy. 
      <br>This tool uses a custom <em>Seeded XorShift64Star</em> algorithm. 
      <br><strong>Same Input ⇒ Exact Same Route.</strong> Every time. It allows you to scientifically refine your trip without chaos.</li>
      
      <li><strong>⚡ Efficiency:</strong> We don't just connect the dots; we solve the <em>Traveling Salesperson Problem</em> (TSP) to physically minimize your travel distance, saving you fuel, time, and energy.</li>
    </ul>
  </div>

  <div class="card help-block">
    <h2>The Vision</h2>
    <p>We are building the ultimate "Traveler's Cockpit."</p>
    <p><strong>Coming Soon:</strong> A universal AI Travel Assistant integrated directly into this workflow. Imagine asking, <em>"Add the best coffee spot near stop #3,"</em> and having it instantly appear on your optimized route.</p>
    <p style="margin-top:15px; border-left: 3px solid var(--accent); padding-left: 10px; color: var(--muted);">
      <em>"Gemini AI confirms: There are no complete, private, client-side tools like this one on the market."</em>
    </p>
  </div>
`;
