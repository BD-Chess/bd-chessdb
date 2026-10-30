// Player-facing copy only. Internal tool codes never appear in the conversation.
export function gameGuideError(code, english = false) {
  const messages = english ? {
    GAME_NOT_OPEN: 'This game is currently open to its owner.', MONTHLY_LIMIT: 'The monthly allowance has been used.',
    RATE_LIMITED: 'The guide needs a short break.', TIMEOUT: 'The reply took too long.', AUTH_REQUIRED: 'Please sign in again.',
    REFRESH_REQUIRED: 'Refresh the page to continue.', TOOL_LIMIT: 'The guide paused. Your message is still in the writing box.',
    OPEN_STEP_REQUIRED: 'The next step has not appeared yet. Your message is still in the writing box.'
  } : {
    GAME_NOT_OPEN: 'Igra je odprta samo lastniku.', MONTHLY_LIMIT: 'Mesečni proračun je porabljen.',
    RATE_LIMITED: 'Vodnik potrebuje kratek premor.', TIMEOUT: 'Odgovor je trajal predolgo.', AUTH_REQUIRED: 'Ponovno se prijavi.',
    REFRESH_REQUIRED: 'Osveži stran za nadaljevanje igre.', TOOL_LIMIT: 'Vodnik se je ustavil. Tvoje sporočilo je ostalo v polju.',
    OPEN_STEP_REQUIRED: 'Naslednji korak se še ni prikazal. Tvoje sporočilo je ostalo v polju.'
  };
  return messages[code] || (english ? 'The reply is incomplete. Your message is still in the writing box.' : 'Odgovor ni dokončan. Tvoje sporočilo je ostalo v polju.');
}
