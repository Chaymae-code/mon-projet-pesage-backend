// ============================================
// SERVEUR WEBSOCKET POUR DASHBOARD TEMPS RÉEL
// ============================================
// Gère les connexions WebSocket et émet les événements temps réel

const { Server } = require('socket.io');
const http = require('http');

let io = null;

/**
 * Initialise le serveur WebSocket
 * @param {http.Server} server - Serveur HTTP existant
 * @returns {Server} Instance Socket.IO
 */
function initializeWebSocket(server) {
  // Initialiser Socket.IO avec CORS sur le serveur existant
  io = new Server(server, {
    cors: {
      origin: process.env.FRONTEND_URL || "http://localhost:5173",
      methods: ["GET", "POST"],
      credentials: true
    },
    transports: ['websocket', 'polling']
  });
  
  // Gestion des connexions
  io.on('connection', (socket) => {
    console.log(`✅ Client WebSocket connecté: ${socket.id}`);
    
    // Envoyer un message de bienvenue
    socket.emit('connected', {
      message: 'Connexion WebSocket établie',
      socket_id: socket.id,
      timestamp: new Date().toISOString()
    });
    
    // Gestion de la déconnexion
    socket.on('disconnect', () => {
      console.log(`❌ Client WebSocket déconnecté: ${socket.id}`);
    });
    
    // Écouter les événements personnalisés (optionnel)
    socket.on('ping', () => {
      socket.emit('pong', { timestamp: new Date().toISOString() });
    });
  });
  
  console.log('✅ Serveur WebSocket initialisé');
  
  return { io, server };
}

/**
 * Émet un événement à tous les clients connectés
 * @param {string} event - Nom de l'événement
 * @param {object} data - Données à envoyer
 */
function emitToAll(event, data) {
  if (io) {
    io.emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
    console.log(`📡 Événement émis: ${event}`, data);
  } else {
    console.warn('⚠️  WebSocket non initialisé, événement non émis:', event);
  }
}

/**
 * Émet un événement à un client spécifique
 * @param {string} socketId - ID du socket
 * @param {string} event - Nom de l'événement
 * @param {object} data - Données à envoyer
 */
function emitToClient(socketId, event, data) {
  if (io) {
    io.to(socketId).emit(event, {
      ...data,
      timestamp: new Date().toISOString()
    });
  }
}

/**
 * Événements spécifiques pour le workflow de pesage
 */
const WeighingEvents = {
  /**
   * Émet quand un camion est détecté et autorisé
   */
  truckArrived: (data) => {
    emitToAll('truck_arrived', {
      event: 'truck_arrived',
      ...data
    });
  },
  
  /**
   * Émet quand l'état d'un pesage change
   */
  weighingStateChanged: (data) => {
    emitToAll('weighing_state_changed', {
      event: 'weighing_state_changed',
      ...data
    });
  },
  
  /**
   * Émet quand le poids est mis à jour
   */
  weightUpdated: (data) => {
    emitToAll('weight_updated', {
      event: 'weight_updated',
      ...data
    });
  },
  
  /**
   * Émet quand un pesage est complété
   */
  weighingCompleted: (data) => {
    emitToAll('weighing_completed', {
      event: 'weighing_completed',
      ...data
    });
  },
  
  /**
   * Émet quand un pesage est annulé
   */
  weighingCancelled: (data) => {
    emitToAll('weighing_cancelled', {
      event: 'weighing_cancelled',
      ...data
    });
  }
};

module.exports = {
  initializeWebSocket,
  emitToAll,
  emitToClient,
  WeighingEvents,
  getIO: () => io
};
