
const { default: makeWASocket, useMultiFileAuthState, DisconnectReason } = require("@whiskeysockets/baileys");
const { Boom } = require("@hapi/boom");
const express = require("express");
const fs = require("fs");

const app = express();
app.use(express.json());

async function startSock() {
  const { state, saveCreds } = await useMultiFileAuthState("auth");

  const sock = makeWASocket({
    auth: state,
    printQRInTerminal: true,
  });

  sock.ev.on("creds.update", saveCreds);

  const { generateWAMessageFromContent, proto } = require("@whiskeysockets/baileys");
  const qrcode = require("qrcode-terminal");
  
  sock.ev.on("connection.update", (update) => {
    const { connection, lastDisconnect, qr } = update;
  
    if (qr) {
      qrcode.generate(qr, { small: true });
    }
  
    if (connection === "close") {
      const shouldReconnect = lastDisconnect?.error?.output?.statusCode !== DisconnectReason.loggedOut;
      console.log("🔁 Conexión cerrada");
      if (shouldReconnect) {
        startSock();
      }
    } else if (connection === "open") {
      console.log("✅ Conectado a WhatsApp");
    }
  });

  sock.ev.on("messages.upsert", async ({ messages, type }) => {
    const msg = messages[0];
    const remoteJid = msg.key.remoteJid;

    if (remoteJid.endsWith("@g.us")) {
      console.log("🧾 ID del grupo:", remoteJid);
    }
  });
  

  // Endpoint para enviar imagen a grupo
  app.post("/send-to-group", async (req, res) => {
    const { groupId, imageUrl, caption } = req.body;
    try {
      await sock.sendMessage(groupId, {
        image: { url: imageUrl },
        caption,
      });
      res.send({ success: true });
    } catch (err) {
      console.error("❌ Error al enviar mensaje:", err);
      res.status(500).send({ error: err.message });
    }
  });
}

startSock();

app.listen(3000, () => console.log("🚀 Servidor corriendo en http://localhost:3000"));
