const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const { GoogleGenerativeAI } = require('@google/generative-ai'); // ✅ Gemini package
const { v4: uuidv4 } = require('uuid');

dotenv.config(); // ✅ load .env

const app = express();

// Middleware
app.use(cors({
  origin: ['https://cetpainfotech-1.onrender.com', 'http://localhost:5173'],
  credentials: true
}));
app.use(express.json());

// ✅ MongoDB Atlas connection - fixed for Mongoose 7+
const mongoURI = process.env.MONGO_URI;

mongoose.connect(mongoURI)
  .then(() => console.log('✅ MongoDB Atlas Connected'))
  .catch(err => console.error('❌ MongoDB Atlas Error:', err.message));

// Schema - same rakha
const messageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  sessionId: { type: String, unique: true },
  messages: [messageSchema]
});

const Chat = mongoose.model('Chat', chatSchema);

// ✅ Gemini initialize - FREE API key!
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// ✅ System prompt for Hinglish/Hindi support
const SYSTEM_PROMPT = `Tu ek helpful AI assistant hai. Tera naam "AI Sahayak" hai.
Tu Hinglish mein baat karta hai - matlab Hindi + English mix.
Short aur clear answers de. Friendly tone rakha kar.
User ko coding, general knowledge, ya kisi bhi topic mein help kar.`;

// ================= ROUTES =================

// Test route
app.get('/', (req, res) => {
  res.json({ status: '✅ Server running with Gemini AI - FREE!' });
});

// 1️⃣ Create session
app.get('/api/chat/session', (req, res) => {
  const sessionId = uuidv4();
  res.json({ sessionId });
});

// 2️⃣ Get history
app.get('/api/chat/history/:sessionId', async (req, res) => {
  try {
    const chat = await Chat.findOne({ sessionId: req.params.sessionId });
    res.json({
      sessionId: req.params.sessionId,
      messages: chat ? chat.messages : []
    });
  } catch {
    res.json({
      sessionId: req.params.sessionId,
      messages: []
    });
  }
});

// 3️⃣ MAIN GEMINI MESSAGE ROUTE
app.post('/api/chat/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;

    let chat = await Chat.findOne({ sessionId });
    if (!chat) {
      chat = new Chat({ sessionId, messages: [] });
    }

    chat.messages.push({ role: 'user', content: message, timestamp: new Date() });

    if (!process.env.GEMINI_API_KEY) {
      const errorMsg = 'Gemini API key nahi mila! Google AI Studio se key bana.';
      chat.messages.push({ role: 'assistant', content: errorMsg, timestamp: new Date() });
      await chat.save();
      return res.json({ message: errorMsg, timestamp: new Date().toISOString() });
    }

    const model = genAI.getGenerativeModel({ 
      model: "gemini-2.5-flash",
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 5000,
        topP: 0.95,
        topK: 40
      }
    });

    const last10Messages = chat.messages.slice(-10);
    let conversationContext = SYSTEM_PROMPT + "\n\n";
    last10Messages.forEach(msg => {
      conversationContext += msg.role === 'user' ? `User: ${msg.content}\n` : `Assistant: ${msg.content}\n`;
    });
    conversationContext += `User: ${message}\nAssistant: `;

    const result = await model.generateContent(conversationContext);
    const aiMessage = (await result.response).text();

    chat.messages.push({ role: 'assistant', content: aiMessage, timestamp: new Date() });
    await chat.save();

    res.json({ message: aiMessage, timestamp: new Date().toISOString() });

  } catch (err) {
    console.error('Gemini error:', err);

    try {
      const { sessionId } = req.body;
      const chat = await Chat.findOne({ sessionId });
      if (chat) {
        chat.messages.push({
          role: 'assistant',
          content: 'Maaf karo, technical dikkat aa gayi. Thodi der baad try karo!',
          timestamp: new Date()
        });
        await chat.save();
      }
    } catch {}

    res.json({ message: 'AI service mein problem hai, baad mein try karo!', timestamp: new Date().toISOString() });
  }
});

// 4️⃣ Clear history
app.delete('/api/chat/history/:sessionId', async (req, res) => {
  await Chat.findOneAndDelete({ sessionId: req.params.sessionId });
  res.json({ message: 'History clear ho gayi!' });
});

// Server
app.listen(5000, () => {
  console.log('Server running at http://localhost:5000');
  console.log('Gemini AI FREE mode activated! No quota tension!');
});
