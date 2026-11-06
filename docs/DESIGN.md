# DESIGN.md

_Look and feel. Read before building or changing any UI. Layout follows a standard LLM chat app (message list, input at the bottom, sidebar of past chats). The identity comes from color, type and icons._

## Mood

Warm, light, friendly. A sunny kitchen in the morning, not a tech product.

## Colors (light theme only, for now)

| Token         | Hex     | Use                                                    |
| ------------- | ------- | ------------------------------------------------------ |
| background    | #FFF8E7 | page background (cream)                                |
| surface       | #FFFDF5 | cards, sidebar, input                                  |
| border        | #E8DCC0 | dividers, outlines                                     |
| text          | #2B2118 | main text (dark warm brown, never pure black)          |
| text-muted    | #6B5B4B | secondary text, timestamps                             |
| accent        | #F2B544 | buttons, highlights (always dark text on it)           |
| accent-strong | #B26A00 | icons and links on cream                               |
| user-message  | #FBE9B7 | the user's chat bubble                                 |
| warning       | #B5472B | "I changed this, double-check" labels and safety notes |

Contrast values are my estimates. **Unverified:** run each text/background pair through a contrast checker (target 4.5:1 or better for body text) before locking these in.

## Typography

- Body: a clean sans-serif, 16px minimum, line height about 1.6.
- Headings and recipe titles: a warm serif for personality.
- Fonts: Fraunces (headings, `--font-serif`), Inter (body, `--font-sans`).
- Keep line length comfortable: replies at most about 70 characters wide.

## Icons

- One icon set, consistent stroke weight, used where an icon helps (send, new chat, delete, timer, step navigation, recipe card). No decorative icons.
- Candidate: lucide-react (needs approval as a dependency).

## Kitchen-use rules (phone, messy hands)

- Tap targets at least 44px.
- Cook-along step text is large and high contrast.
- Primary actions (next step, send) sit within thumb reach.

## Responsive testing

Test every UI change on more than one screen size: a phone, a tablet (portrait and landscape) and a laptop or desktop window. Browser device emulation (F12) is only a rough check, so use a real device when possible.
Check these on each size:

- The chat input stays visible and usable when the on-screen keyboard is open.
- The layout still fits when the mobile address bar shows or hides (viewport height changes).
- Nothing is hidden under notches or home bars (safe-area insets).
- The sidebar of past chats works at every width (for example, it collapses on narrow screens).
- Text stays readable and tap targets stay at least 44px at every size.
- Long messages and recipe cards don't cause sideways scrolling.
  Before using any viewport or safe-area technique, check the bundled Next.js docs and the Tailwind docs. Don't rely on memory.

## Key screens

- **Chat:** standard layout. Assistant replies sit directly on the background, user messages in the soft yellow bubble.
- **Recipe card:** surface color, serif title, clear split between "from the source recipe" and "changed by me" (warning color).
- **Cook-along:** one step per screen, big text, big next/back buttons.

## Don'ts

- No purple or blue gradients, no gradient text.
- No pure white or pure black backgrounds and text.
- No emoji as decoration.
- No heavy shadows or glassy effects.
- No more than one accent color plus the warning color.
