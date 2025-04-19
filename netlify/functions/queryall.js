// netlify/functions/queryall.js
const fetch = require('node-fetch');

exports.handler = async function(event) {
  // get fen and learn from the query string
  const { fen = '', learn = '0' } = event.queryStringParameters || {};
  const url = `https://www.chessdb.cn/queryall?fen=${encodeURIComponent(fen)}&learn=${learn}`;

  try {
    const resp = await fetch(url);
    const text = await resp.text();            // <— plain‑text response
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*',
      },
      body: text
    };
  } catch (err) {
    console.error("ChessDB fetch error:", err);
    return {
      statusCode: 500,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: `Error fetching from ChessDB: ${err.message}`
    };
  }
};
