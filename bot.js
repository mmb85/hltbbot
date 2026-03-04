require("dotenv").config();

const TelegramBot = require("node-telegram-bot-api");
const buscarJuego = require("./scraper");
const { LRUCache } = require('lru-cache');

const token = process.env.BOT_TOKEN;

const bot = new TelegramBot(token, { polling: true });

/*
Simple cache (5 min)
Evita scrapear lo mismo muchas veces
*/
const cache = new LRU({
    max: 100,
    ttl: 1000 * 60 * 60
});

/*
Queue system ultra simple
Evita correr Puppeteer en paralelo
*/
let queue = Promise.resolve();

bot.on("message", async msg => {
    const chatId = msg.chat.id;
    const game = msg.text?.trim();

    if (!game) return;

    bot.sendMessage(chatId, "🔍 Buscando...");

    queue = queue.then(async () => {

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

        } catch {
            bot.sendMessage(chatId, "⚠️ Error buscando el juego");
        }

    });
});

function formatReply(data) {
    return (
        `🎮 ${data.titulo}\n\n` +
        `🕐 Main: ${data.main || "N/A"}\n` +
        `➕ Extra: ${data.extra || "N/A"}\n` +
        `🏆 100%: ${data.completionist || "N/A"}`
    );
}