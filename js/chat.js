import { addChatMessage, getState, setChatPending, subscribe } from "./state.js";
import { askTrainer } from "./api.js";

const createMessageMarkup = ({ role, text }) => `<div class="message ${role}">${text}</div>`;

export const createChatController = ({ elements }) => {
  const renderMessages = () => {
    if (!elements.chatBody) return;
    const { chat } = getState();
    elements.chatBody.innerHTML = chat.history.map(createMessageMarkup).join("");
    elements.chatBody.scrollTop = elements.chatBody.scrollHeight;
  };

  const renderPendingState = () => {
    const { chat } = getState();
    if (elements.chatForm) {
      const submitButton = elements.chatForm.querySelector("button[type=submit]");
      if (submitButton) {
        submitButton.disabled = chat.pending;
        submitButton.textContent = chat.pending ? "Отправка..." : "Отправить";
      }
    }
  };

  const sendQuestion = async (question) => {
    if (!question.trim()) return;

    addChatMessage({ role: "user", text: question });
    renderMessages();
    setChatPending(true);

    const { onboarding } = getState();
    const context = JSON.stringify(onboarding);

    try {
      const answer = await askTrainer(question, context);
      addChatMessage({ role: "trainer", text: answer });
    } catch (error) {
      addChatMessage({ role: "trainer", text: "Не удалось получить ответ, попробуйте позже." });
      console.warn("Chat request failed", error);
    } finally {
      setChatPending(false);
      renderMessages();
    }
  };

  const handleFormSubmit = (event) => {
    event.preventDefault();
    if (!elements.chatInput) return;
    const value = elements.chatInput.value;
    elements.chatInput.value = "";
    sendQuestion(value);
  };

  const openChat = () => {
    if (elements.chatModal && typeof elements.chatModal.showModal === "function") {
      elements.chatModal.showModal();
      renderMessages();
      if (elements.chatInput) {
        elements.chatInput.focus();
      }
    }
  };

  const closeChat = () => {
    if (elements.chatModal && typeof elements.chatModal.close === "function") {
      elements.chatModal.close();
    }
  };

  const bindEvents = () => {
    if (elements.chatForm) {
      elements.chatForm.addEventListener("submit", handleFormSubmit);
    }

    if (elements.chatOpen) {
      elements.chatOpen.addEventListener("click", openChat);
    }

    if (elements.chatClose) {
      elements.chatClose.addEventListener("click", closeChat);
    }
  };

  subscribe(() => {
    renderMessages();
    renderPendingState();
  });

  bindEvents();
  renderMessages();
  renderPendingState();

  return {
    openChat,
    closeChat
  };
};
