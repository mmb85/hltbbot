const puppeteer = require("puppeteer-extra");
const StealthPlugin = require("puppeteer-extra-plugin-stealth");

puppeteer.use(StealthPlugin());

/*
Custom rounding rule:
- decimal < 0.3 → floor
- decimal ≥ 0.3 → .5 step
*/
function customRoundHours(seconds) {
    if (!seconds) return null;

    const hoursRaw = seconds / 3600;
    const integerPart = Math.floor(hoursRaw);
    const decimalPart = hoursRaw - integerPart;

    if (decimalPart < 0.3) return integerPart;
    return integerPart + 0.5;
}

async function buscarJuego(nombre) {

    const browser = await puppeteer.launch({
        headless: true,

        // 🔥 CLAVE PARA RENDER
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]
    });

    const page = await browser.newPage();

    let resultData = null;

    // Mejorar fingerprint básico
    await page.setUserAgent(
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120 Safari/537.36"
    );

    // Intercept API response
    page.on("response", async response => {
        try {
            const url = response.url();

            if (url.includes("/api/finder")) {
                const json = await response.json();

                if (json?.data?.length) {
                    const juego = json.data[0];

                    resultData = {
                        titulo: juego.game_name || null,

                        main: juego.comp_main !== undefined
                            ? `${customRoundHours(juego.comp_main)} Hours`
                            : null,

                        extra: juego.comp_plus !== undefined
                            ? `${customRoundHours(juego.comp_plus)} Hours`
                            : null,

                        completionist: juego.comp_100 !== undefined
                            ? `${customRoundHours(juego.comp_100)} Hours`
                            : null
                    };
                }
            }
        } catch (err) {
            console.error("Intercept error:", err.message);
        }
    });

    const query = encodeURIComponent(nombre);

    await page.goto(
        `https://howlongtobeat.com/?q=${query}`,
        {
            waitUntil: "networkidle2",
            timeout: 30000
        }
    );

    // Esperar resultado interceptado (máx 10s)
    for (let i = 0; i < 20; i++) {
        if (resultData) break;
        await new Promise(r => setTimeout(r, 500));
    }

    await browser.close();

    return resultData;
}

// CLI execution
if (require.main === module) {
    const juego = process.argv.slice(2).join(" ");

    if (!juego) {
        console.log("Usage: node scraper.js <game name>");
        process.exit(1);
    }

    buscarJuego(juego).then(console.log);
}

module.exports = buscarJuego;