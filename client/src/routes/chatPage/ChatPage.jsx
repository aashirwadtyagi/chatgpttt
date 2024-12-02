import { useEffect, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useLocation } from "react-router-dom";
import Markdown from "react-markdown";
import model from "../../lib/gemini";
import "./chatPage.css";

const ChatPage = () => {
  const path = useLocation().pathname;
  const chatId = path.split("/").pop();
  const endRef = useRef(null); // Reference for auto-scrolling

  const [messages, setMessages] = useState([]);
  const [isStreaming, setIsStreaming] = useState(false); // Prevent multiple inputs during streaming

  // Initialize chat instance with history
  const chat = model.startChat({
    history: messages.map(({ role, text }) => ({
      role,
      parts: [{ text }],
    })),
  });

  // Fetch chat history on component load
  const { isLoading, error, data } = useQuery({
    queryKey: ["chat", chatId],
    queryFn: () =>
      fetch(`${import.meta.env.VITE_API_URL}/api/chats/${chatId}`, {
        credentials: "include",
      }).then((res) => res.json()),
    onSuccess: (data) => {
      setMessages(data.history || []);
    },
  });

  // Auto-scroll to the latest message
  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const addMessage = async (text) => {
    setIsStreaming(true); // Prevent multiple inputs while streaming

    // Add user message to the state
    setMessages((prev) => [...prev, { role: "user", text }]);

    // Add an empty system message to the state to update later
    setMessages((prev) => [...prev, { role: "system", text: "" }]);

    try {
      const result = await chat.sendMessageStream([text]);
      let accumulatedText = "";

      // Stream and accumulate the system response dynamically
      for await (const chunk of result.stream) {
        accumulatedText += chunk.text();

        // Update the last system message with streamed content
        setMessages((prev) =>
          prev.map((msg, index) =>
            index === prev.length - 1 && msg.role === "system"
              ? { ...msg, text: accumulatedText }
              : msg
          )
        );
      }
    } catch (err) {
      console.error(err);

      // Update system message to show an error message
      setMessages((prev) =>
        prev.map((msg, index) =>
          index === prev.length - 1 && msg.role === "system"
            ? { ...msg, text: "Oops! Something went wrong. Please try again." }
            : msg
        )
      );
    } finally {
      setIsStreaming(false); // Re-enable input once streaming is complete
    }
  };

  const handleSubmit = (e) => {
    e.preventDefault();
    const text = e.target.text.value.trim();
    if (!text || isStreaming) return; // Prevent submission if input is empty or streaming

    addMessage(text);
    e.target.reset(); // Clear the input field
  };

  return (
    <div className="chatPage">
      <span className="title">Ask MY.AI your questions</span>
      <div className="wrapper">
        <div className="chat">
          {/* Render all messages dynamically */}
          {messages.map((msg, index) => (
            <div
              key={index}
              className={`message ${msg.role === "user" ? "user" : "system"}`}
            >
              <Markdown>{msg.text}</Markdown>
            </div>
          ))}

          {/* Scroll reference */}
          <div ref={endRef}></div>

          {/* Input form */}
          <form className="newForm" onSubmit={handleSubmit}>
            <input
              type="text"
              name="text"
              placeholder="Ask anything..."
              autoFocus
              disabled={isStreaming} // Disable input during streaming
            />
            <button className="send" type="submit" disabled={isStreaming}>
              <img src="/arrow.png" alt="Send" />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
};

export default ChatPage;
