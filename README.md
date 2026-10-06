# hangouts

Source and catalog for Hangouts Zero. `Zero.html` fetches everything below through jsDelivr
(`cdn`, `fastly`, `gcore`) from `gh/onyxpowered/hangouts@main`.

| path | what Zero reads |
| --- | --- |
| `NAGO/UATH.json` | the catalog |
| `NAGO/SOTA/`, `NAGO/UGHN/` | posters, screenshots |
| `HTAS/NGOU.json`, `HTAS/OATG/` | home slides and their images |
| `HSNT/<season>/<category>/<id>/` | `game.hngts` or `game.hngts.partN` |
| `HSNT/<season>/TSOH.txt`, `TSOH.txt` | legal notices (optional) |

Maintainer tool (`node tools/publish.mjs`): `add`, `check`, `publish`. `publish` pushes, then purges
jsDelivr for every changed file so all three mirrors serve the new commit.

Originals and reserved creators are dropped by Zero unless the entry carries a valid `seal`.
Licensing: see `Zero.NOTICE.md`.
