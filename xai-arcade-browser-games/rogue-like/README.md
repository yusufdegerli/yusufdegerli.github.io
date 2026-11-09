# Ashen Years

A fast 2D action platformer built with [Phaser 3](https://phaser.io/). Dark pit-fighting, timing-based martial combat, and an aging death system.

## Play

This project is static ES modules, so it needs a local web server (opening `index.html` as a file will fail CORS).

```bash
# Python
python3 -m http.server 8080

# or Node
npx --yes serve -l 8080
```

Then open [http://localhost:8080](http://localhost:8080).

## Controls

| Action | Keys |
| --- | --- |
| Move | `A` / `D` or arrows |
| Jump / double jump | `Space` / `W` / `↑` |
| Dash | `Shift` |
| Strike / combo | `J` / `Z` |
| Heavy charge | Hold `J` for 1 second, then release |
| Aerial slam | `S` / `↓` + `J` in the air |
| Dash thrust | `Shift` |
| Block / Parry | `K` / `X` |
| Grapple / swing | `Q` or right mouse (aim with mouse, `A`/`D` to pump, `W`/`S` to reel) |
| Ashbolt (ranged special) | `F` / `E` |
| Dodge | `L` / `C` |
| Pause | `Esc` |

Combat is timing, not mashing. Enemies flash amber while they wind up. The intent bar turns pale in the last instant — press block then to **parry**. A parry stuns them. Strike while they are open for a **riposte**. Holding block early only reduces damage.

## Aging

You start at **20**. When health hits 0 you stand back up, older by a random number of years. Max health drops. Attack damage rises. At **80 or older**, the next knockout is a real game over and you restart at 20.

Reach the gold **GATE** at the far right to escape.

Each run **generates a new pit** with binary space partitioning (rooms, ceilings, walls, gaps). Grapple (`Q` / right-click) latches onto stone and swings with pendulum physics. Enemies pathfind across platforms — they jump gaps and drop down to hunt you.

The pit is larger now: melee ghouls, cinderhound rushers, teal **shooters**, purple **mages** that heal allies, and red **kamikaze** hounds. Watch for floor and wall spikes, wooden bridges that collapse a second after you step on them, and teal bounce pads that launch you (and enemies) to high ledges. **Ashbolt** (`F`) is a ranged soul shot that spends the teal energy bar.
