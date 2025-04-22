// functions/queryall.js
const fetch = require('node-fetch');

exports.handler = async (event) => {
  const params = event.queryStringParameters || {};
  const board  = params.board || params.fen;
  if (!board) {
    return { statusCode: 400, body: 'Missing required parameter: board or fen' };
  }

  const learn   = params.learn   === '1' ? '1' : '0';
  const showall = params.showall === '1' ? '1' : '0';
  const egtb    = params.egtbmetric
                ? `&egtbmetric=${encodeURIComponent(params.egtbmetric)}`
                : '';

  const url = `https://www.chessdb.cn/cdb.php?action=queryall`
            + `&board=${encodeURIComponent(board)}`
            + `&learn=${learn}`
            + `&showall=${showall}`
            + egtb;

  try {
    const resp = await fetch(url);
    if (resp.status === 404) {
      return {
        statusCode: 404,
        headers: { 'Access-Control-Allow-Origin': '*' },
        body: 'Position not found in database'
      };
    }
    const text = await resp.text();
    return {
      statusCode: 200,
      headers: {
        'Content-Type': 'text/plain',
        'Access-Control-Allow-Origin': '*'
      },
      body: text
    };
  } catch (err) {
    console.error('queryall error:', err);
    return {
      statusCode: 502,
      headers: { 'Access-Control-Allow-Origin': '*' },
      body: `Upstream fetch error: ${err.message}`
    };
  }
};
