import {PlaneTrackResponse} from "./PlaneTrackResponse";

export interface TrackSource{
    getPlaneStatus(icao24: string): Promise<PlaneTrackResponse|null>;
}
