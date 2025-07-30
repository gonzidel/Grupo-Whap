
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

  // Endpoint para publicar múltiples imágenes
  app.post("/publicar", async (req, res) => {
    const { grupoId, mensaje, imagenes } = req.body;
    try {
      for (const url of imagenes) {
        await sock.sendMessage(grupoId, { 
          image: { url }, 
          caption: mensaje 
        });
      }
      res.status(200).send({ status: 'ok' });
    } catch (error) {
      console.error('Error enviando mensaje:', error);
      res.status(500).send({ status: 'error', error });
    }
  });
}

startSock();

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`🚀 Servidor Express corriendo en puerto ${PORT}`);
});
