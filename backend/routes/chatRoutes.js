const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { v4: uuidv4 } = require('uuid');

// 🔥 SIMPLE Schema - Bina kisi complication ke
const messageSchema = new mongoose.Schema({
  role: String,
  content: String,
  timestamp: { type: Date, default: Date.now }
});

const chatSchema = new mongoose.Schema({
  sessionId: String,
  messages: [messageSchema]
});

// Model - agar exist karta hai to use karo, nahi to create karo
const Chat = mongoose.models.Chat || mongoose.model('Chat', chatSchema);

// ✅ 1. GENERATE SESSION
router.get('/session', (req, res) => {
  try {
    const sessionId = uuidv4();
    console.log(' Session created:', sessionId);
    res.json({ sessionId });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});


// ✅ 2. GET HISTORY - FIXED VERSION (YEHI CHALEGA)
router.get('/history/:sessionId', async (req, res) => {
  try {
    const { sessionId } = req.params;
    console.log(' Fetching history for:', sessionId);
    
    // Simple find - error handling ke saath
    let chat = null;
    try {
      chat = await Chat.findOne({ sessionId });
    } catch (dbError) {
      console.log('DB Find error:', dbError.message);
    }
    
    // Agar chat nahi mila to empty array do
    if (!chat) {
      console.log(' No history found, returning empty');
      return res.json({ 
        sessionId, 
        messages: [] 
      });
    }
    
    console.log(` Found ${chat.messages?.length || 0} messages`);
    res.json(chat);
    
  } catch (error) {
    console.error(' History error:', error.message);
    // Error mein bhi empty response do - frontend crash na ho
    res.json({ 
      sessionId: req.params.sessionId, 
      messages: [] 
    });
  }
});

// ✅ 3. SEND MESSAGE - SIMPLE VERSION (BINA STREAMING KE)
router.post('/message', async (req, res) => {
  try {
    const { sessionId, message } = req.body;
    
    console.log('📨 Message received:', { sessionId, message: message.substring(0, 50) });

    // OpenAI API Key check
    if (!process.env.OPENAI_API_KEY) {
      return res.status(500).json({ 
        error: 'OPENAI_API_KEY not found in .env file',
        solution: 'Add your OpenAI API key to .env file'
      });
    }

    // Find or create chat
    let chat = await Chat.findOne({ sessionId });
    if (!chat) {
      chat = new Chat({ 
        sessionId, 
        messages: [] 
      });
      console.log(' New chat session created');
    }

    // Add user message
    chat.messages.push({
      role: 'user',
      content: message,
      timestamp: new Date()
    });

    // OpenAI call
    const OpenAI = require('openai');
    const openai = new OpenAI({
      apiKey: process.env.OPENAI_API_KEY
    });

    console.log(' Calling OpenAI API...');
    
    const completion = await openai.chat.completions.create({
      model: 'gpt-3.5-turbo',
      messages: [
        { role: 'system', content: 'You are a helpful assistant.' },
        ...chat.messages.map(msg => ({
          role: msg.role,
          content: msg.content
        }))
      ],
      temperature: 0.7,
      max_tokens: 500
    });

    const aiResponse = completion.choices[0].message.content;
    console.log(' OpenAI response received');

    // Add AI response
    chat.messages.push({
      role: 'assistant',
      content: aiResponse,
      timestamp: new Date()
    });

    // Save to database
    await chat.save();
    console.log(' Chat saved to database');

    // Send response
    res.json({ 
      message: aiResponse,
      timestamp: new Date().toISOString()
    });

  } catch (error) {
    console.error(' ERROR:', error);
    
    // Specific error messages
    if (error.status === 401) {
      res.status(401).json({ 
        error: 'Invalid OpenAI API key',
        solution: 'Check your API key in .env file'
      });
    } else if (error.code === 'ECONNREFUSED') {
      res.status(500).json({ 
        error: 'MongoDB not connected',
        solution: 'Run "mongod" in terminal'
      });
    } else {
      res.status(500).json({ 
        error: error.message,
        solution: 'Check backend console for details'
      });
    }
  }
});

// ✅ 4. CLEAR HISTORY
router.delete('/history/:sessionId', async (req, res) => {
  try {
    await Chat.findOneAndDelete({ sessionId: req.params.sessionId });
    console.log(' Chat deleted:', req.params.sessionId);
    res.json({ message: 'Chat history cleared' });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;