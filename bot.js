require("dotenv").config();

const express = require("express");
const TelegramBot = require("node-telegram-bot-api");
const buscarJuego = require("./scraper");
const { LRUCache } = require("lru-cache");

const token = process.env.BOT_TOKEN;
const url = process.env.RENDER_EXTERNAL_URL;

if (!token) {
    console.error("❌ BOT_TOKEN no definido");
    process.exit(1);
}

if (!url) {
    console.error("❌ RENDER_EXTERNAL_URL no definido");
    process.exit(1);
}

const bot = new TelegramBot(token);
const app = express();

app.use(express.json());

// Cache 1 hora
const cache = new LRUCache({
    max: 100,
    ttl: 1000 * 60 * 60
});

// Endpoint webhook
app.post(`/bot${token}`, (req, res) => {
    bot.processUpdate(req.body);
    res.sendStatus(200);
});

// Comando tipo: /hltbbot The Witcher 3
bot.onText(/\/hltbbot (.+)/, async (msg, match) => {
    const chatId = msg.chat.id;
    const game = match[1].trim();

    bot.sendMessage(chatId, "🔍 Buscando...");

    try {
        if (cache.has(game)) {
            return bot.sendMessage(chatId, formatReply(cache.get(game)));
        }

        const data = await buscarJuego(game);

        if (!data) {
            return bot.sendMessage(chatId, "❌ No encontrado");
        }

        cache.set(game, data);

        bot.sendMessage(chatId, formatReply(data));

    } catch (err) {
        console.error(err);
        bot.sendMessage(chatId, "⚠️ Error buscando el juego");
    }
});

function formatReply(data) {
    return (
        `🎮 ${data.titulo}\n\n` +
        `🕐 Main: ${data.main || "N/A"}\n` +
        `➕ Extra: ${data.extra || "N/A"}\n` +
        `🏆 100%: ${data.completionist || "N/A"}`
    );
}

const PORT = process.env.PORT || 3000;

app.listen(PORT, async () => {
    console.log(`🚀 Servidor activo en puerto ${PORT}`);

    await bot.setWebHook(`${url}/bot${token}`);
    console.log("✅ Webhook configurado correctamente");
});
