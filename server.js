import "dotenv/config";
import express from "express";
import cors from "cors";
import { Client, GatewayIntentBits } from "discord.js";

const app = express();
app.use(cors());

// Admin role IDs – doplň svoje ID
const ADMIN_ROLES = [
  "1145441979870740590" // Admin
];

// Discord klient
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.GuildPresences
  ]
});

// Cache členov
let voiceMembers = [];

// Pomocná funkcia – vracia aj roles
function formatMember(member) {
  return {
    id: member.user.id,
    name: member.displayName,
    avatar: member.user.displayAvatarURL({ size: 64 }),
    status: member.presence?.status || "offline",
    channelName: member.voice.channel?.name || null,
    roles: member.roles.cache.map(r => r.id)
  };
}

// Aktualizácia zoznamu každé 2 sekundy
async function refreshVoiceMembers() {
  const guild = client.guilds.cache.get(process.env.GUILD_ID);
  if (!guild) return;

  const newList = [];

  const allVoiceChannels = guild.channels.cache
    .filter(ch => ch.type === 2) // GUILD_VOICE
    .map(ch => ch.name);

  for (const [_, vs] of guild.voiceStates.cache) {
    const member = vs.member;
    const status = member.presence?.status || "offline";

    if (!vs.channelId) continue;
    if (status === "offline") continue;
    if (status === "invisible") continue;

    // Načítame člena kompletne, aby mal roles
    const fullMember = await guild.members.fetch(member.id).catch(() => null);
    if (!fullMember) continue;

    newList.push(formatMember(fullMember));
  }

  // Zoradenie – admini hore
  voiceMembers = newList.sort((a, b) => {
    const aIsAdmin = a.roles && a.roles.some(r => ADMIN_ROLES.includes(r));
    const bIsAdmin = b.roles && b.roles.some(r => ADMIN_ROLES.includes(r));

    if (aIsAdmin && !bIsAdmin) return -1;
    if (!aIsAdmin && bIsAdmin) return 1;

    return (a.name || "").localeCompare(b.name || "");
  });

  // Prázdne kanály
  allVoiceChannels.forEach(channelName => {
    const exists = newList.some(m => m.channelName === channelName);
    if (!exists) {
      voiceMembers.push({
        id: null,
        name: null,
        avatar: null,
        status: null,
        channelName
      });
    }
  });
}

// Keď sa bot prihlási
client.on("ready", async () => {
  console.log(`Bot prihlásený ako ${client.user.tag}`);
  setInterval(refreshVoiceMembers, 2000);
});

// API endpoint
app.get("/members", (req, res) => {
  res.json(voiceMembers);
});

// Spustenie API
app.listen(process.env.PORT || 3000, () => {
  console.log("API beží na porte 3000");
});

// Prihlásenie bota
client.login(process.env.BOT_TOKEN);
