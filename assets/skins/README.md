# Skin assets

Each skin is a folder holding two PNG files:

- `idle.png`: shown while the pet is standing still.
- `walk.png`: shown for a short moment after the pet moves.

```
assets/skins/
  skin1/ ... skin5/        one folder per selectable skin
  random_pool/
    <any_name>/            sub-folders the RANDOM option chooses from
```

Notes:

- If a PNG is missing, the pet draws a coloured circle instead.
- If `walk.png` is missing, `idle.png` is used for walking too.
- Images are scaled to fit the pet's 60x60 box, keeping their aspect ratio.
- `RANDOM` picks one `random_pool/` sub-folder when the app starts and keeps it for that session.
  If `random_pool/` has no sub-folders, it picks from `skin1` to `skin5` instead.
