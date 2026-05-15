export interface GeoTag {
  lat: number;
  lng: number;
  city?: string;
  region?: string;
  country?: string;
  accuracy?: number;
}

interface MeetingRecord {
  geoTag: GeoTag;
  notifyUrl: string;
  participantName: string;
  createdAt: Date;
}

// In-memory store keyed by roomId.
// For production, replace with Redis or a DB.
const store = new Map<string, MeetingRecord>();

const MeetingStore = {
  set(roomId: string, record: MeetingRecord) {
    store.set(roomId, record);
  },

  get(roomId: string): MeetingRecord | undefined {
    return store.get(roomId);
  },

  delete(roomId: string) {
    store.delete(roomId);
  },
};

export default MeetingStore;
