import { defineStore } from 'pinia'

export const useMuseumwayfinding = defineStore('museumwayfinding', {
  state: () => ({
    // Current user location (from QR code)
    currentLocation: null,
    
    // List of all rooms in the museum
    rooms: [],
    
    // List of artworks with their locations
    artworks: [],
    
    // The route from current position to destination
    wayfindingRoute: [],
    
    // Current level being displayed
    currentLevel: 0,
    
    // Indicates if user is in a room (for QR code scanning)
    isInRoom: false,
    
    // List of visited rooms for route history
    visitedRooms: []
  }),
  
  actions: {
    // Set the current location from a scanned QR code
    setCurrentLocation(roomId) {
      this.currentLocation = roomId;
      
      // Find room details
      const room = this.rooms.find(r => r.id === roomId);
      if (room) {
        this.currentLevel = room.level;
        this.isInRoom = true;
        
        // Add to visited rooms list
        if (!this.visitedRooms.includes(roomId)) {
          this.visitedRooms.push(roomId);
        }
      } else {
        this.isInRoom = false;
      }
    },
    
    // Set the destination artwork from a QR code scan
    setDestinationArtwork(artworkId) {
      const artwork = this.artworks.find(a => a.id === artworkId);
      if (artwork && artwork.roomId !== this.currentLocation) {
        // Calculate route to that artwork's room
        this.calculateRouteToRoom(artwork.roomId);
      }
    },
    
    // Calculate the wayfinding path between rooms
    calculateRouteToRoom(destinationRoomId) {
      // In a real implementation, we would use a graph-based routing algorithm
      // For now, just simulate with simple logic based on room connections
      const route = [];
      
      if (this.currentLocation && this.rooms.length > 0) {
        const startRoom = this.rooms.find(r => r.id === this.currentLocation);
        const endRoom = this.rooms.find(r => r.id === destinationRoomId);
        
        // For demo purposes, we'll just add a simple path
        route.push(startRoom);
        if (startRoom && endRoom) {
          // Add intermediate rooms to the path - in real app would be more complex logic
          const roomConnections = this.getRoomConnections();
          
          // Simple example: direct connection between start and destination
          if (roomConnections[startRoom.id] && roomConnections[startRoom.id].includes(endRoom.id)) {
            route.push(endRoom);
          }
        }
      }
      
      this.wayfindingRoute = route;
    },
    
    // Get connections between rooms (simplified)
    getRoomConnections() {
      // In a real app, this would be based on OSM data
      return {
        1: [2],   // Room 1 connects to room 2
        2: [1, 3], // Room 2 connects to rooms 1 and 3
        3: [2, 4]  // Room 3 connects to rooms 2 and 4
      };
    },
    
    // Reset wayfinding state
    resetwayfinding() {
      this.wayfindingRoute = [];
      this.currentLocation = null;
      this.isInRoom = false;
    }
  },
  
  getters: {
    // Get current room name by ID
    getCurrentRoomName: (state) => (roomId) => {
      const room = state.rooms.find(r => r.id === roomId);
      return room ? room.name : 'Unknown Room';
    }
  }
})