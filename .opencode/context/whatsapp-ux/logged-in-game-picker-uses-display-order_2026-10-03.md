When a logged-in manager chooses "1. Submit a match result → 1. A game's score for the first time", the bot lists fixtures in grouped buckets ("Today's games", "Earlier this week", "Later this week", then "Backdoor-result games (last 7 days)"). It numbers them sequentially as they appear in the message, but was storing `displayed_fixtures` as `combined = [...cat1, ...cat2]` (database order, not display order). If a manager's games were ordered differently in cat1 than in the buckets (e.g. a yesterday game appears before today in matchday order), picking option 2 from the message would select the wrong fixture ID.

The fix builds `displayOrder` in the same order items are written to the lines (following bucket order), writes it to the session, and removes the initial upsert that used `combined`. This ensures the number the user replies with always maps to the fixture shown at that position.

**Fix applied to:** `app/api/webhook/route.ts` in `handleLoggedInFirstTimeList()` (around line 1409+). After grouping cat1 into buckets, we push each item's id into `displayOrder` as we emit its line, then upsert the session with `displayed_fixtures: displayOrder`.

**Impact:** Only the logged-in "submit new score" picker (state `loggedin_first_time_pick`). Other pickers already build their own ordered lists. No schema changes.
