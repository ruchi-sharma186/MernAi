import React, { useState, useEffect, useRef } from 'react';
import axios from 'axios';
// import { v4 as uuidv4 } from 'uuid';
import { FaPaperPlane, FaTrash, FaSpinner } from 'react-icons/fa';
import Message from './Message';
import './ChatInterface.css';

const API_URL = 'https://mernai-ggtu.onrender.com/api';

const ChatInterface = () => {
  const [messages, setMessages] = useState([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [sessionId, setSessionId] = useState('');
  const messagesEndRef = useRef(null);

  useEffect(() => {
    initializeSession();
  }, []);

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  const initializeSession = async () => {
    try {
      let storedSessionId = localStorage.getItem('chatSessionId');
      
      if (!storedSessionId) {
        console.log('Creating new session...');
        const response = await axios.get(`${API_URL}/chat/session`);
        storedSessionId = response.data.sessionId;
        localStorage.setItem('chatSessionId', storedSessionId);
      }
      
      setSessionId(storedSessionId);
      console.log('Session ID:', storedSessionId);
      
      // Load chat history
      const historyResponse = await axios.get(`${API_URL}/chat/history/${storedSessionId}`);
      if (historyResponse.data.messages) {
        setMessages(historyResponse.data.messages);
      }
    } catch (error) {
      console.error('Session error:', error);
    }
  };

  const sendMessage = async (e) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMessage = {
      role: 'user',
      content: input,
      timestamp: new Date().toISOString()
    };

    setMessages(prev => [...prev, userMessage]);
    setInput('');
    setLoading(true);

    try {
      console.log('Sending message...');
      const response = await axios.post(`${API_URL}/chat/message`, {
        sessionId,
        message: input
      });

      const aiMessage = {
        role: 'assistant',
        content: response.data.message,
        timestamp: response.data.timestamp || new Date().toISOString()
      };

      setMessages(prev => [...prev, aiMessage]);
      console.log('Message sent successfully');
    } catch (error) {
      console.error('Send error:', error);
      let errorMessage = 'Sorry, I encountered an error.';
      
      if (error.response?.data?.error) {
        errorMessage = `Error: ${error.response.data.error}`;
      }
      
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: errorMessage,
        timestamp: new Date().toISOString()
      }]);
    } finally {
      setLoading(false);
    }
  };

  const clearHistory = async () => {
    try {
      await axios.delete(`${API_URL}/chat/history/${sessionId}`);
      setMessages([]);
      localStorage.removeItem('chatSessionId');
      initializeSession();
    } catch (error) {
      console.error('Clear error:', error);
    }
  };

  return (
    <div className="chat-container">
      <div className="chat-header">
        <h1>🤖 MERN AI Chatbot</h1>
        <button className="clear-btn" onClick={clearHistory} title="Clear chat">
          <FaTrash />
        </button>
      </div>

      <div className="messages-container">
        {messages.length === 0 ? (
          <div className="welcome-message">
            <h2>Welcome to MERN AI Chatbot!</h2>
            <p>Ask me anything - I'm here to help!</p>
            <div className="example-questions">
              <button onClick={() => setInput("What is MERN stack?")}>
                What is MERN stack?
              </button>
              <button onClick={() => setInput("Tell me a joke")}>
                Tell me a joke
              </button>
              <button onClick={() => setInput("How does AI work?")}>
                How does AI work?
              </button>
            </div>
          </div>
        ) : (
          messages.map((msg, index) => (
            <Message key={index} message={msg} />
          ))
        )}
        {loading && (
          <div className="typing-indicator">
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
            <div className="typing-dot"></div>
          </div>
        )}
        <div ref={messagesEndRef} />
      </div>

      <form className="input-container" onSubmit={sendMessage}>
        <textarea
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && sendMessage(e)}
          placeholder="Type your message here..."
          rows={1}
          disabled={loading}
        />
        <button 
          type="submit" 
          className="send-btn"
          disabled={loading || !input.trim()}
        >
          {loading ? <FaSpinner className="spinner" /> : <FaPaperPlane />}
        </button>
      </form>
    </div>
  );
};

export default ChatInterface;
