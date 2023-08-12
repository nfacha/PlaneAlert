import axios from "axios";
import {PlaneAlert} from "../../index";
import {PlaneTrackResponse} from "../PlaneTrackResponse";
import {TrackSource} from "../TrackSource";

export class RadarPlaneSource implements TrackSource {

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null> {
        PlaneAlert.log.debug(`Getting plane status for ${icao24} from RadarPlane`);
        const rx = await axios.get(`https://radarplane.com/api/v1/aircraft/live/single/${icao24}`);
        if (rx.data.data['planes'] === null) {
            return null;
        }
        if (rx.data.data['planes'].length === 0) {
            return null;
        }
        const state = rx.data.data['planes'].find((a: any) => a['icao'].toLowerCase() === icao24.toLowerCase());
        if (state === undefined) {
            return null;
        }

        return {
            icao24: icao24,
            callsign: state['callsign'],
            longitude: state['longitude'],
            latitude: state['latitude'],
            barometricAltitude: state['altitude_ft'],
            onGround: state['on_ground'],
            velocity: 0,//Not available at this time
            verticalRate: 0,//Not available at this time
            squawk: state['squawk'],
            emergencyStatus: null,
        }
    }

    getPlanesBySquawk(squawk: number): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('RadarPlane TrackSource does not support squawk lookup at this time');
            resolve(null);
        });
    }

    getPlanesByType(type: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('RadarPlane TrackSource does not support type lookup at this time');
            resolve(null);
        });
    }

    getPlanesByOperator(operator: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('RadarPlane TrackSource does not support operator lookup at this time');
            resolve(null);
        });
    }
}
