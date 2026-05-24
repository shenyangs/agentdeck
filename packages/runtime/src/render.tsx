import React from "react";
import { createRoot } from "react-dom/client";
import type { DeckDocument } from "@agentdeck/schema";
import { AgentDeckApp } from "./App.js";
import "./styles.css";

declare global {
  interface Window {
    __AGENTDECK_DECK__?: DeckDocument;
  }
}

const deck = window.__AGENTDECK_DECK__;
const root = document.getElementById("root");

if (!deck || !root) {
  throw new Error("AgentDeck runtime requires window.__AGENTDECK_DECK__ and #root.");
}

createRoot(root).render(
  <React.StrictMode>
    <AgentDeckApp deck={deck} />
  </React.StrictMode>,
);
