export interface PlaneTrackResponse{
    icao24: string;
    callsign: string|null;
    longitude: number|null;
    latitude: number|null;
    barometricAltitude: number|null;
    onGround: boolean;
    velocity: number|null;
    verticalRate: number|null;
    squawk: number|null;
    emergencyStatus: any;
}
