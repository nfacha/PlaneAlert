import {PlaneTrackResponse} from "./PlaneTrackResponse";

export interface TrackSource {
    getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null>;

    getPlanesBySquawk(squawk: number): Promise<PlaneTrackResponse[] | null>;

    getPlanesByType(type: string): Promise<PlaneTrackResponse[] | null>;

    getPlanesByOperator(operator: string): Promise<PlaneTrackResponse[] | null>;
}
