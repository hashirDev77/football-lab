# Football API Report

**API:** `https://sports-api.sportsdata365.com/msdata/v1/football/`  
**Product:** Football Lab — a football app built on the SportsAPI365 Football REST catalogue (43 endpoints)  
**Scope:** REST GET only. No streaming, alerts, predictions, or third-party score comparison.

This is the combined record of two pieces of work. First we built a real football product on the 43-route catalogue and walked every screen. Then we called every endpoint properly — pagination, errors, missing fields, coverage — and asked whether the payload can actually feed those screens.

The question throughout:

> Can someone ship a complete football product using only these 43 endpoints?

**Short answer:** yes for a first product, no for a complete match-centre experience without extra work. Search, teams, competitions, standings, match detail, incidents, and statistics work. Live home scores, lineups, injuries, weather, head-to-head, manager pages, and several match extras do not yet behave like a product API. Coverage also changes by match: the same path can be a full XI on one game and an empty shell or a 404 on another.

Nothing below was invented. Search and directories returned the ids. The product only rendered what the API gave us.

---

## 1. What we built

Football Lab is a small football product a customer could reasonably expect from a sports data API:

**Home** (live / today / upcoming / finished) → **Matches** → **Match centre** → **Team** → **Player** → **Competition** → **Search**

It is not a production consumer app. It is the proof that the Football API can, or cannot, support those screens without extra work.

The stack is a Fastify BFF (`apps/api`) and a Vite + React UI (`apps/web`). Every product screen talks to our BFF (`/app/football/...`). The BFF talks to SportsAPI365, normalises the payload, and records a gap whenever a field, relationship, or filter the screen needs is missing, empty, 404, slow, or shaped differently from another route. The UI is thin: it never calls the provider directly.

That split was deliberate. List routes and detail routes do not share one schema. Search and today’s fixtures use `items`. Player and team match lists use `events`. Squad uses `players`. Player match stats use `playerStatistics`. Seasons use `seasons`. Status is a string on lists and an object on detail. Kickoff is unix seconds on lists. A UI that consumed the raw feed would have to special-case every screen. The BFF does that once, and records the special case as a gap.

The app runs locally as two processes:

- Web UI: `http://127.0.0.1:5174`
- BFF: `http://127.0.0.1:8788`

Admin tools sit at `/admin/gaps`, `/admin/coverage`, `/admin/endpoint-lab`, and `/admin/report`.

Screen loaders were written against a product contract, not against “HTTP 200.” A live home card is expected to have teams, status, kickoff, score, and competition. A lineup tab is expected to have 11 starters, player ids, positions, shirts, and a formation. When the provider does not meet the contract, the loader still tries to render the screen: it may call `/event/{id}` for each live row that has no score, it may hide a tab on a 404, and it may show “data unavailable” when an envelope is empty. Those workarounds keep the product usable. They are also the evidence that the API is not yet product-complete.

The UI never invents a 0–0, an empty injury list, or a fake XI.

### Pages

| Screen | Route | Job | Endpoints it depends on |
| --- | --- | --- | --- |
| Home | `/` | What is happening in football right now | `/fixtures/today`, `/events`, `/tournaments` |
| Matches | `/matches` | Browse live / today / upcoming / results | `/events`, `/fixtures/today` |
| Match centre | `/match/:id` | Header + tabs (overview, timeline, lineups, stats, …) | `/event/{eventId}` and the 13 event extras |
| Teams | `/teams`, `/team/:id` | Find a club, squad, matches, form | `/teams` and the 13 team routes |
| Players | `/players`, `/player/:id` | Directory and profile | `/players`, `/player/{playerId}`, player events, season stats |
| Manager | `/manager/:id` | Staff profile | `/manager/{managerId}` |
| Competitions | `/competitions`, `/competition/:id` | Directory, fixtures, table | `/tournaments` and the 6 unique-tournament routes |
| Search | `/search` | Find a club, player, or league by name | `/search` |
| Admin | `/admin/gaps`, `/coverage`, `/endpoint-lab`, `/report` | Gap dashboard and catalogue lab | same 43 routes, via the BFF |

Home, when we first walked it, loaded live matches, today’s list, upcoming kickoffs, finished games, and featured competitions. That one screen needed **6 provider calls** (3 of them fallbacks) and recorded **60 gaps**. That is the product working, and the API telling us what is missing.

---

## 2. Issues we found while building the product

These showed up on real screens, not only in a catalogue sweep. A 200 was not enough. If the screen still needed a fallback, a hidden tab, or a guess, we recorded it.

### Home cannot be a live scoreboard from the list

`/fixtures/today` and `/events` return teams, status, and kickoff, but **list rows often have no score**. Home had to call `/event/{id}` for each live card. That is an N+1 pattern on the first screen a user opens.

`status` is a **string** on lists and an **object** on detail. `startTimestamp` is unix seconds on lists. Featured competitions from `/tournaments` are usable, but country/region on the card was often missing, and the call was slow enough that it should not sit on the critical home path.

**Product impact:** Home looks like a football app. A live scoreboard cannot be built from the day’s fixture list alone.

### Match → Competition navigation breaks

Match detail loads. Tournament **name** can appear while `uniqueTournament.id` is **null**. The match centre cannot open the competition page unless the UI cached the id from an earlier list. That is a broken relationship, not a missing widget.

### Match centre tabs are coverage-dependent

The match centre is the largest page (14 event routes). What we saw while wiring tabs:

- **Incidents** and **statistics** were strong on covered matches. Timeline is one of the best routes in the catalogue.
- **Lineups** were often an empty `{ home, away }` shell on the match Home had opened. You cannot draw a starting XI from that. A later catalogue pass found a real XI on a different, well-covered finished match. Formation and manager id were still missing.
- **Injuries**, **weather**, **pregame form**, and **H2H** came back as tiny 200 envelopes. Empty is not “no injuries,” “no weather,” or “no previous meetings.”
- **Best players**, **team streaks**, and **typed enrichments** 404’d on the match the product opened first. The same paths returned data on a covered finished match. A 404 here looks like “match not found” unless the client special-cases the message.
- **Player-in-match stats** 404 when that player is not in the XI. Same overload: it reads as if the match is missing.
- Match **enrichments** `types` was empty on some matches and populated on others. Do not assume odds, news, or predictions live there.

**Product impact:** You can open a match, show teams, score (after detail), incidents, and statistics. You cannot ship a broadcast-quality match centre without hiding half the tabs, or without knowing which matches are “covered.”

### Team pages are the strongest family

Squad, previous/next matches, media, competitions, and standings-seasons are shippable. The squad payload is large enough to group GK / DF / MF / FW if `position` is populated.

Issues that still showed up in the product:

- Team profile has **no logo**; crests live on `/media`.
- **Featured-event** returns a match but does not mean “currently live.” `/near-events` is the better “what’s next” API.
- Rankings and performance need a documented **scope** (which competition, which window).
- Team season statistics **404** if you pair a team with a tournament/season it does not play. When the triple actually matches, the route works.

### Player pages are thin; manager is a dead end

You can open a player and see recent matches. Country, date of birth, photo, height, and shirt number are not guaranteed. Season statistics 404 even when the player, league, and season look related. The client has to guess the tournament + season triple.

Lineups and match detail did not emit a manager id we could resolve. `/manager/{id}` 404s without one. The manager screen is not shippable.

### Search finds real names, not typos

Exact and partial club / player / competition names resolve. A misspelling does not. Hits need `type`, `id`, and `name`. Duplicate rows should be unique.

### Schema and list-key drift (every screen paid for this)

The BFF exists because the catalogue does not unwrap the same way twice:

| Feed | List key |
| --- | --- |
| Search, today, `/events`, directories | `items` |
| Team / player / competition matches | `events` |
| Squad | `players` |
| Match timeline | `incidents` |
| Player match stats | `playerStatistics` |
| Seasons | `seasons` |
| Standings | `standings` (groups, not a page of rows) |

A client that only reads `items` will silently drop squad, timeline, and player stats.

---

## 3. How we tested

Testing was done in layers. Together they are the basis of this report.

1. **Product walk.** We built the screens, opened Home → match → team → player → competition → search, and recorded a gap whenever a widget was empty, hidden, or assembled from extra calls.
2. **Catalogue sweep.** Every one of the 43 routes was called with real ids from search and directories — not invented ids.
3. **Depth pass.** Pagination (page 1 vs page 2 vs a huge page), status filters (`notstarted` / `inprogress` / `finished`), `last` / `next`, standings `total` / `home` / `away`, and error cases (missing `q`, non-numeric id, unknown id, bad date, invalid direction, invalid standings type).
4. **Coverage pass.** The same match extra was tried on several matches. That is how we learned lineups / best-players / streaks are not “broken” on every match and not “working” on every match either.

We did not treat HTTP 200 as a pass. A 200 with an empty envelope is **Empty**. A 404 on an optional extra is **Not available**, not “match missing.”

| Result | Meaning |
| --- | --- |
| **Works** | 200 with data a screen can show |
| **Partial** | 200, but the screen still needs extra calls, hiding, or guessing |
| **Empty** | 200 with nothing useful. Not the same as “no injuries” or “no weather” |
| **Not available** | 404 on an optional extra. The parent match / player / team still exists |
| **Expected** | 400 or 404 on a bad request (missing query, non-numeric id, bad date, bad enum) |

---

## 4. Pagination

List routes use **1-based `page`** and `limit`, and usually return the list plus `total`, `totalPages`, and `hasMore`.

What we confirmed:

- Page 2 returns a **different slice**, not a repeat of page 1, on `/events`, `/fixtures/today`, `/teams`, `/players`, `/tournaments`, team matches, player matches, competition matches, seasons, and team media.
- A huge page number returns **200 with an empty list**, not 404. That is the right behaviour.
- Search needs `q` of **2–80 characters** (letters, numbers, spaces, `'`, `.`, `-`). A one-character query is rejected. An out-of-range search page is empty 200.
- Squad (`/team/{id}/players`), match enrichments, and standings groups are **not paginated** even when the payload is large. Squad is a single dump.
- Match **incidents** and **player-statistics** are paginated. A timeline or player-stats tab that only reads page 1 will be incomplete. Default page size on incidents is small.

`direction` on match lists is `last` or `next`. Anything else is 400.

`standings/{type}` is `total`, `home`, or `away`. Anything else is 400.

---

## 5. Errors

These are reliable and should be handled as client mistakes or missing extras, not as “the feed is down.”

| Situation | HTTP | Behaviour |
| --- | --- | --- |
| Search with no `q` | 400 | Validation message about allowed characters and length. It does not simply say “q is required.” |
| Non-numeric id (`/event/abc`) | 400 | Numeric string expected |
| Unknown match / team / player id | 404 | Named “was not found” |
| Invalid calendar date | 400 | Expected `YYYY-MM-DD` |
| Invalid `direction` | 400 | Enum expected |
| Invalid standings type | 400 | Enum expected |
| Optional extra not on file (best players, streaks, season stats, player-in-match stats) | 404 | Looks like the parent entity is missing unless the client special-cases the message |
| Empty extras (weather, h2h, lineups on an uncovered match) | 200 | Tiny envelope. Easy to misread as “no weather” or “no injuries” |

**Improvement:** optional extras should return **200 empty** with a reason (`unsupported`, `not_in_match`, `no_coverage`). Reserve 404 for “this match / player / team does not exist.”

---

## 6. Catalogue results

Paths are relative to `/v1/football`. Every route below was called. Match extras are **state and coverage dependent**: on a finished, well-covered match, lineups, incidents, statistics, best players, and streaks all loaded. On other matches the same paths were an empty shell or a 404.

### Lists and search

| Endpoint | Data type | Result | Pagination | Proper data? | Missing / issues | Improvement |
| --- | --- | --- | --- | --- | --- | --- |
| `/search` | Paginated hit list (`items`) | **Works** | Yes. `q` required, 2–80 chars. Out-of-range page → empty 200 | Yes for real names (club, player, competition). Hits carry id / name / type | Misspellings do not resolve. Duplicate hits possible | Fuzzy / alias search. Keep `type` on every row |
| `/events` | Paginated match list (`items`) | **Partial** | Yes. `status` = `notstarted` \| `inprogress` \| `finished` all return data. Page 2 is a new slice | Teams, status, kickoff. Live / finished / upcoming filters work | **Score is often missing on the row.** Status is a string here, an object on detail | Put score, minute, and competition on every list row. One status object everywhere |
| `/fixtures/today` | Paginated match list (`items`) | **Partial** | Yes. Page 2 does not overlap page 1 | Today’s card works as a schedule | Same missing score. Home cannot be a live scoreboard without N+1 `/event/{id}` | Same as `/events` — scores on the list |
| `/players` | Paginated directory (`items`) | **Works** | Yes | Name + id at directory scale | Cards are thin (no photo, team, or position) | Add photo, current team, position |
| `/teams` | Paginated directory (`items`) | **Works** | Yes | Name + id | No crest / country on the card | Add logo and country |
| `/tournaments` | Paginated directory (`items`) | **Works** | Yes | Competition names | Region / country often missing | Add category, country, logo |

### Match centre

| Endpoint | Data type | Result | Pagination | Proper data? | Missing / issues | Improvement |
| --- | --- | --- | --- | --- | --- | --- |
| `/event/{eventId}` | Match object (`event`) | **Works** / **Partial** in the product | No | Header is usable: teams, status object, score, tournament | Tournament **name** can appear while tournament **id** is null, which breaks Match → Competition | Always emit `uniqueTournament.id` with the name. ISO kickoff on list and detail |
| `/event/{eventId}/best-players` | Best player + leaderboard | **Works** when covered; **Not available** (404) otherwise | Leaderboard is paged | Home / away best player and a ranking list on a covered finished match | Ranking rule is not documented. 404 on uncovered matches | 200 empty when not covered. Document what “best” means |
| `/event/{eventId}/enrichments` | Type list (`types`) | **Works** when covered; **Empty** otherwise | Not paged | Covered matches list extras (average positions, best players, highlights, shotmap, streaks, votes, …) | Empty `types` on other matches looks like “no extras exist in the product” | Publish the type catalogue. Empty list = no extras **on this match** |
| `/event/{eventId}/enrichments/{type}` | Typed extra (shape depends on type) | **Works** when the type exists; **Not available** (404) otherwise | Depends on type | First listed type returned a real payload on a covered match | 404 if you guess a type that is not on this match | 200 empty for unknown / unsupported type |
| `/event/{eventId}/h2h` | Head-to-head object | **Empty** | No | Keys exist (`teamDuel`, `managerDuel`) | No previous-meetings list, no event ids to open | Return historical matches with `eventId`, or a documented empty object |
| `/event/{eventId}/incidents` | Paginated timeline (`incidents`) | **Works** | Yes — page 1 is not the full match | Goals, cards, substitutions on a covered match | Player / team id is not always obvious next to the name. Page size is small | Guarantee `playerId` and `teamId`. Default a larger page or cursor |
| `/event/{eventId}/injuries` | Home / away envelope | **Partial** | No | Covered match returns a non-empty envelope | Empty envelope on other matches. Empty is **not** “nobody is injured” | `{ coverage, home, away }`. Never imply a clean bill of health |
| `/event/{eventId}/lineups` | Home / away envelope | **Partial** | No | Covered finished match returns a real XI | Formation and manager id often missing. Uncovered / not-started matches return an empty home/away shell | 11 starters, bench, shirts, positions, formation, coach, confirmed vs expected. Empty shell needs a coverage flag |
| `/event/{eventId}/player-statistics` | Paginated player stats | **Works** when covered; **Empty** otherwise | Yes | Per-player match figures on a covered match | List key is `playerStatistics`, not `items`. Easy to miss if the client only unwraps `items` | Keep one list key across the catalogue, or document this key |
| `/event/{eventId}/player/{playerId}/statistics` | Player match stats | **Not available** if that player is not in the match | No | — | 404 reads as “match missing” | 200 `{ available: false, reason: "player_not_in_match" }` |
| `/event/{eventId}/pregame-form` | Home / away form | **Works** when populated; **Empty** otherwise | No | Recent form can appear | Tiny empty envelope on other matches | Always return last-N results, or `{ available: false }` |
| `/event/{eventId}/statistics` | Match statistics object | **Works** | No | Strong payload on a covered match | Uncovered matches return almost nothing. Empty stats ≠ 0% possession | Keep the shape stable. Never fake zeros |
| `/event/{eventId}/team-streaks` | Streak / H2H summary | **Works** when covered; **Not available** (404) otherwise | No | General and head-to-head windows on a covered match | 404 on uncovered matches | 200 empty. Document the window |
| `/event/{eventId}/weather` | Weather object | **Empty** | No | Envelope only (`conditions`) | Cannot tell “not provided” from “clear conditions” | Coverage flag. Do not ship a weather tab on an empty object |

### Player and manager

| Endpoint | Data type | Result | Pagination | Proper data? | Missing / issues | Improvement |
| --- | --- | --- | --- | --- | --- | --- |
| `/player/{playerId}` | Player object (`player`) | **Partial** | No | Name and enough to open a profile | Country and date of birth often missing. Photo / height / shirt are not guaranteed | Fill the career card. Missing fields stay missing in the UI — do not invent them |
| `/player/{playerId}/events/{direction}` | Paginated match list (`events`) | **Works** | Yes. `last` / `next` only | Recent list is large and usable. Upcoming can be a short list | Upcoming rows have no score (fair). Invalid direction → 400. No player-level figures on the row | Do not put the player’s own match figures on these rows unless documented |
| `/player/{playerId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics` | Season statistics object | **Works** or **Not available** | No | Returns player / team / statistics when the file exists | 404 even when the player, league, and season look related. Clients have to guess the triple | A player-level stats index. 200 empty when not on file |
| `/manager/{managerId}` | Manager object | **Not available** | No | — | Lineups and match detail did not emit a manager id we could resolve | Emit manager id from lineup / team. Only then is this route useful |

### Team

This is the strongest family in the catalogue.

| Endpoint | Data type | Result | Pagination | Proper data? | Missing / issues | Improvement |
| --- | --- | --- | --- | --- | --- | --- |
| `/team/{teamId}` | Team object (`team`) | **Partial** | No | Name and profile header | Logo missing on the profile (images live on `/media`) | Put crest on the team object |
| `/team/{teamId}/players` | Squad list (`players`) | **Works** | **No** — one large dump | Full squad. Positions exist so you can group GK / DF / MF / FW | Player id/name sit nested, not always on the top row | Paginate or document “full dump.” Keep `position` populated |
| `/team/{teamId}/events/{direction}` | Paginated match list (`events`) | **Works** | Yes | Previous and upcoming lists are real | Upcoming rows have no score | Same list-score improvement as `/events` |
| `/team/{teamId}/featured-event` | Match object | **Works** | No | Returns a match | Meaning is unclear — not “currently live” | Document as editorial. Prefer `/near-events` for “what’s next” |
| `/team/{teamId}/near-events` | Previous / next match | **Works** | No | Clear `previousEvent` / `nextEvent` | — | Keep this as the “what’s next” API |
| `/team/{teamId}/performance` | Form list + points | **Works** | Yes | Recent form window | Ranking / competition scope is not obvious | Document the window and competition |
| `/team/{teamId}/rankings` | Paginated rankings | **Works** | Yes | Ranking rows exist | Context (which ranking list?) is unclear | Name the ranking and the date |
| `/team/{teamId}/unique-tournaments` | Paginated competitions | **Works** | Yes | Needed to discover `tournamentId` for later stats | — | — |
| `/team/{teamId}/standings-seasons` | Paginated season links | **Works** | Yes | Use this instead of guessing season ids | Two keys (`uniqueTournamentSeasons`, `tournamentSeasons`) | Prefer one list key |
| `/team/{teamId}/unique-tournament/{tournamentId}/season/{seasonId}/statistics` | Season statistics object | **Works** when the triple matches; **Not available** otherwise | No | Usable when the team actually plays that competition/season | 404 if you pair a random team with a random league | 200 empty, or publish which triples exist |
| `/team/{teamId}/media` | Paginated media | **Works** | Yes | Crest / images | Profile still has no logo field | Reuse these URLs on `/team/{id}` |
| `/team/{teamId}/enrichments` | Type list | **Works** | Not paged | Types are listed (unlike many match enrichment indexes) | — | Keep match-side enrichments this consistent |
| `/team/{teamId}/enrichments/{type}` | Typed extra (often an event list) | **Works** | Yes for event-shaped types | Real payload for a listed type | Shape changes by type | Document each type |

### Competition

| Endpoint | Data type | Result | Pagination | Proper data? | Missing / issues | Improvement |
| --- | --- | --- | --- | --- | --- | --- |
| `/unique-tournament/{tournamentId}` | Competition object | **Partial** | No | Name and overview | `currentSeasonId` can be missing — you must call `/seasons` | Always emit current season |
| `/unique-tournament/{tournamentId}/events` | Paginated match list (`events`) | **Works** | Yes | Large, usable fixture/result list | Can include old seasons if not filtered | Document default season |
| `/unique-tournament/{tournamentId}/scheduled-events/{date}` | Paginated match list | **Empty** on a quiet day; **Expected** 400 on a bad date | Yes | Empty day is valid. Bad date is clearly `YYYY-MM-DD` | Empty day vs “this league is not covered that day” is still ambiguous | Coverage flag on empty days |
| `/unique-tournament/{tournamentId}/seasons` | Paginated seasons | **Works** | Yes | Source of truth for season ids | — | Never hardcode seasons |
| `/unique-tournament/{tournamentId}/season/{seasonId}/round/{round}` | Paginated matchday list | **Works** | Yes | Round 1 returned a full match list | Whether `round` is a number, a name, or both is not documented | Document round identity |
| `/unique-tournament/{tournamentId}/season/{seasonId}/standings/{type}` | Standings groups | **Works** | Not paged as a list of pages | `total`, `home`, and `away` all returned tables on a major league | Cup competitions will not look like a league table. Goal difference is not guaranteed | Do not force GD / home / away columns. Document `type` |

---

## 7. What a football product can ship today

| Need | Ready? | What we saw in the product and in testing |
| --- | --- | --- |
| Today’s matches | Yes | `/fixtures/today` works as a schedule |
| Live scores on the home card | Partial | Live filter works. The list often has no score. Home did N+1 detail calls |
| Match timeline | Yes, on covered matches | Incidents are paginated — read every page |
| Match statistics | Yes, on covered matches | Strong payload. Do not hardcode metrics. Do not fake 0% |
| Lineups | Partial | Real XI on some finished matches. Empty shell on others. Formation / manager often missing |
| Injuries / weather / H2H | Weak | Empty 200 or a thin envelope. Do not claim “none” |
| Best players / streaks | Coverage-dependent | 200 on a covered match, 404 on others |
| Team squad and match lists | Yes | Strongest part of the API |
| League table | Yes | `standings/total` is usable. Home / away worked on a major league |
| Search | Partial | Real names work. Typos do not. `q` is required |
| Manager page | No | No reliable id from lineup / match, and the route 404s without one |
| Player season stats | Partial | Works for some triples, 404 for others that look valid |
| Odds / news / predictions | Unknown | Enrichment types are empty on some matches. Do not assume they exist |

---

## 8. What is missing, and what to improve

Highest value first.

1. **Scores on list rows.** `/fixtures/today` and `/events` should include score, minute, and competition. That removes N+1 detail calls on Home.
2. **One event schema.** Status object and ISO kickoff on both list and detail. Always emit tournament id with the name so Match → Competition works.
3. **Optional extras must not 404.** Best players, streaks, enrichment types, player-in-match stats, missing season stats: return 200 empty with a reason. 404 is for “this match does not exist.”
4. **Empty vs unsupported.** Weather, injuries, lineups, form, H2H, scheduled-events: add an explicit coverage flag. An empty 200 is currently ambiguous.
5. **Lineups that can draw an XI.** Starters, bench, shirts, positions, formation, coach, confirmed vs expected — on every covered match, and an honest empty state otherwise.
6. **One list key, or document them.** `items` vs `events` vs `players` vs `playerStatistics` vs `incidents`. Paginate or document the squad dump. Incidents default page is too small for a full timeline.
7. **Search quality.** Aliases and misspellings are part of a football product.
8. **Manager id on the lineup.** Without it, `/manager/{id}` is a dead route.
9. **Do not 404 season statistics** for a valid player or team that simply has no file for that tournament/season. Publish which triples exist, or return coverage.
10. **Document ranking / “best” / featured-event.** If the API cannot say what the field means, the UI must not guess.
11. **Crest on the team object.** Images already exist on `/media`.
12. **Current season on the competition object.** Clients should not have to call `/seasons` just to know which table to load.

---

The Football API is good enough to start a product. Search, teams, competitions, standings, match detail, incidents, and statistics are shippable. A complete match centre still depends on coverage, and several extras still fail as 404 or empty 200 instead of a clear “not on this match.” The screens we built only render what the API gave us.
