# Pizza Defense Game

A fun arcade-style game where you control a pizza slice defending against enemy fast food!

## How to Play
- Control a pizza slice character by dragging with your mouse or finger
- Automatically shoot at incoming enemy fast food items
- Defeat waves of enemies to progress
- Upgrade your stats after completing levels

## Deploying as a Telegram Mini App

To set up this game as a Telegram Mini App:

1. Enable GitHub Pages in your repository settings (Settings > Pages)
   - Set the source to the main branch
   - Your game will be available at `https://goose61.github.io/pizzadef/`

2. Talk to [@BotFather](https://t.me/BotFather) on Telegram
   - Use the `/newapp` command
   - Provide the URL to your hosted game: `https://goose61.github.io/pizzadef/`
   - Follow the instructions to complete the setup

3. To integrate with the Telegram Mini App API, add the following to your `index.html`:
   ```html
   <script src="https://telegram.org/js/telegram-web-app.js"></script>
   ```

4. Initialize the Telegram Web App in your game code:
   ```javascript
   // Add to game.ts
   if (window.Telegram && window.Telegram.WebApp) {
     const tg = window.Telegram.WebApp;
     tg.ready();
     tg.expand();
   }
   ```

## Development

- Built with TypeScript
- Uses Webpack for bundling
- Runs on any modern browser 