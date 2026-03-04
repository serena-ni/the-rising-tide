# The Rising Tide Assets

This project already includes placeholder PNG files so the game runs immediately.

## Current placeholder image files

### Backgrounds
- `assets/backgrounds/beach_surface.png` (opening scene far/background)
- `assets/backgrounds/underwater_shallow.png` (menu + game mid layer)
- `assets/backgrounds/underwater_deep.png` (game near/deep layer)

### Sprites
- `assets/sprites/player.png`
- `assets/sprites/fish1.png`
- `assets/sprites/fish2.png`
- `assets/sprites/fish3.png`
- `assets/sprites/fish4.png`
- `assets/sprites/fish5.png`
- `assets/sprites/trash1.png`
- `assets/sprites/trash2.png`
- `assets/sprites/trash3.png`
- `assets/sprites/trash4.png`
- `assets/sprites/platform_rock.png`
- `assets/sprites/bubble_collectible.png`
- `assets/sprites/water_overlay.png`

Legacy placeholders from earlier iterations are still present and can be deleted later if not needed.

## How to replace with final pixel art

1. Keep the same filenames and folder paths.
2. Export your final art at matching dimensions (or adjust `setScale` in scene code).
3. Drop files in place and refresh the browser.

Because scene preload keys already target these paths, replacement requires no code changes if filenames stay the same.

## Optional audio files to add later

- `assets/audio/beach_ambience.ogg`
- `assets/audio/underwater_ambience.ogg`
- `assets/audio/collect.wav`
- `assets/audio/bump.wav`

Current ambience and small effects are procedural WebAudio placeholders, so audio files are optional for now.
