# Labyrinth

A mobile puzzle game: explore a 6×6 labyrinth, record the map on sheets, and match the sheets after falling into a pit. Carry the chest out through the exit.

A static web app with no build step: open `index.html` or run a local server from the project root:

```
py -m http.server 8000
```

(on macOS/Linux: `python3 -m http.server 8000`), then open http://localhost:8000.

- Screens: start, game, pause/settings, results with the true map and a check of your hypotheses.
- Controls: arrows/WASD, `M` mode, `F` take treasure, `Space` pin, `H` hide overlay, `Q`/`E` sheets, `Esc` pause; on a phone — the d-pad. Duel with a host has its own keys (`X` `K` `P` `R` `V`), see below.
- The game and settings are saved in `localStorage`.

## Duel mode (MVP)

Two players on one screen, the game itself acts as the host (rules: [Cyclowiki, "Лабиринт (игра на бумаге)" — "Labyrinth (paper game)"](https://cyclowiki.org/wiki/%D0%9B%D0%B0%D0%B1%D0%B8%D1%80%D0%B8%D0%BD%D1%82_(%D0%B8%D0%B3%D1%80%D0%B0_%D0%BD%D0%B0_%D0%B1%D1%83%D0%BC%D0%B0%D0%B3%D0%B5))).

- Every game is a new random 6×6 labyrinth: walls, 3 pits in a cycle, a treasure, a hospital, an arsenal, and an exit on the edge.
- Players take turns, passing the device via the "Pass the turn" screen. Each has their own sheets and their own map hypothesis; the starting cell is unknown.
- The host reports only the cell type ("empty cell", "pit", "hospital", "arsenal", "treasure", "exit") or "wall". The pit number is never revealed, and bumping into a wall spends the turn.
- A pit carries you to the next pit in the cycle; a wall bump or a skipped turn while standing in a pit also carries you away.
- Actions: step, shoot (the bullet flies until it hits a wall or a player), dagger strike (in your own cell), skip turn. The arsenal gives 3 bullets and 3 daggers, the hospital heals.
- A wounded player cannot shoot or carry the treasure; the treasure stays where they were wounded. Whoever carries the treasure out through the exit wins.
- After the game the true map and each player's hypothesis check are revealed.

Out of the MVP for now: rivers, bombs, cement, the bear, a false treasure, online play.

## Duel with a host («Дуэль с ведущим»)

The second duel mode, closer to the paper game: the game plays the human **host** («Ведущий») and **speaks** every result aloud. Players draw the map **on paper**; the app keeps no sheets for them.

**Choosing a duel.** Starting a duel offers two modes, picked per match: the classic «Дуэль» (above, unchanged) or «Дуэль с ведущим». Tapping the duel button on the start screen opens a full-screen chooser with two equal cards, «Дуэль с ведущим» and «Классическая дуэль», plus «Отмена» (`Esc` also cancels). Each card starts its own flow.

**How a match goes**

- Same rules, same random 6×6 labyrinth as the classic duel (pits in a cycle, treasure, hospital, arsenal, exit, wounds, bullets, daggers).
- Before the first line there is a short intro screen (paper-and-pen reminder, voice status with its on/off switch, «Начать игру», «В меню»); that tap is also the user gesture browsers require before they will speak. The host then announces each player's starting cell type and who moves first as one line. The start cell is not marked on any map.
- Both players are in front of the same device and hear the same announcements: the host's lines are **public**, so there is no «Pass the turn» screen.
- The screen shows only whose turn it is («Ход игрока N»), that player's status (health, bullets, daggers, whether they carry the treasure), the available actions, the latest host line, and a **log of every host line** of the game (newest first). There is no map, no sheets, no overlay, no hypotheses.
- Each turn is one action: step, shoot (aim, then direction), dagger strike, or skip. Unavailable actions are disabled with the reason shown inside the button («ранен», «нет патронов», «нет кинжалов»); a rejected keyboard action shows a short notice and keeps the turn. Shoot and dagger fire on one tap, with no confirmation and no undo.
- The host says only what the paper-game host may say: the cell type or "wall", hit or miss, who is wounded, who picked up or dropped the treasure, the direction of a shot. Pit numbers, coordinates and the treasure location are never announced.
- **Controls lock until the line is spoken.** After an action the host line is read to the end, and only then does the turn pass. A wall bump still spends the turn; an action that is rejected (for example, shooting with no bullets) does not.
- Whoever carries the treasure out through the exit wins. The host announces the winner; once the line is spoken, «К итогам» opens the results screen: the winner, each player's turn count, the **true map** on the «Карта» tab and the full host log on the «Журнал» tab. «Сыграть ещё» starts a new host match, «В меню» returns to the start screen. Drawing both players' routes over the results map is not included.

**Voice**

- Voice is on by default (text always shows). The voice switch is in the turn-screen header and in Settings («Голос ведущего»). «Повторить» (repeat) sits on the latest-line card and re-speaks the last line without changing whose turn it is.
- Speech uses the browser's built-in Web Speech API, so **it depends on the voices installed in your browser or OS**. The app looks for a `ru-RU` voice, then any Russian voice, then any English voice; Settings shows which one was found.
- With no usable voice (or no `speechSynthesis` at all) the app stays silent and shows the note «Голос недоступен — только текст». The game never waits on speech that cannot play, and a stuck synthesizer cannot freeze a match.
- The interface and host lines are Russian only for now; other languages are a separate planned feature.

**Settings (host mode)** — all three are in Settings (open it with the pause button or `Esc`) and are saved in `localStorage`:

| Setting | Default | What it does |
|---------|---------|--------------|
| «Голос ведущего» | on | The host speaks every line. Off: text only, with no wait before the turn passes. Turning it off mid-line cuts the speech and unlocks the controls at once. |
| «Пауза после хода» | on | After the turn passes, action controls and action keys stay disabled for 300 ms before the next player's controls unlock, so a stray second tap from the previous player cannot fire an irreversible action. Host mode only. Repeat, voice and pause keep working during the pause; other keys pressed during it are ignored silently. Applies with voice off too. |
| «Говорить, чей ход» | off | On: after each action line the host also says «Ход игрока N» (the phrase is part of the same log line), and the controls unlock only after it. Off: the turn change is shown on screen only. |

**Controls (host mode)**

- Keys are read by physical key (`e.code`), so they work on a Russian layout. They are active in host mode only; classic duel and Solo keys are unchanged.

| Action | Key |
|--------|-----|
| Step | arrows or `W` `A` `S` `D` |
| Shoot: arm, then press a direction | `X` (`X` again or `Esc` cancels the aim) |
| Dagger strike | `K` |
| Skip turn | `P` |
| Repeat last line | `R` |
| Voice on/off | `V` |
| Cancel aim, then pause | `Esc` |

- The Settings key legend lists these keys on its own «Дуэль с ведущим» line.
- On a phone: touch buttons, with shoot and dagger separated from the step pad to avoid accidental taps.
- The acting player's bullets and wounds are shown on the shared screen, so the opponent can see them (accepted trade-off).
- There is no «skip the line» button while the host is speaking. The ways out are the voice switch and the pause button / `Esc`: each cancels the current speech and unlocks the controls at once. While locked, only repeat, voice and pause respond.
- In aim mode the step pad turns into a fire pad (red, «Огонь» in the centre): the next direction fires.

The duel is not saved: closing the page ends the match (the settings above are kept).

**Code layout.** `host.js` holds the pure core (Russian message catalogue, rules engine, speech wrapper, turn controller) and has no DOM; the host screens and keys live in the fenced `host:start … host:end` block of `game.js`. Every host line comes from the catalogue in `host.js`. Tests run with Node, no dependencies: `node --test tests/`.

Created from a design in Claude (Artifact "Лабиринт — полная партия" / "Labyrinth — full game").
