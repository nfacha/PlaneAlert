import axios from "axios";
import {PlaneAlert} from "../../index";
import {PlaneTrackResponse} from "../PlaneTrackResponse";
import {TrackSource} from "../TrackSource";

export class Dump1090Source implements TrackSource {

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null> {
        PlaneAlert.log.debug(`Getting plane status for ${icao24} from Dump1090`);
        if(PlaneAlert.config.tracksource.dump1090.base === null) {
            PlaneAlert.log.error(`Dump1090 base URL not set`);
            return null;
        }
        const rx = await axios.get(PlaneAlert.config.tracksource.dump1090.base)
        if (rx.data['aircraft'] === null) {
            return null;
        }
        if (rx.data['aircraft'].length === 0) {
            return null;
        }
        const state = rx.data['aircraft'].find((a: any) => a['hex'].toLowerCase() === icao24.toLowerCase());
        if (state === undefined) {
            return null;
        }

        return {
            icao24: icao24,
            callsign: state['flight'].trim(),
            longitude: state['lon'],
            latitude: state['lat'],
            barometricAltitude: state['alt_baro'],
            onGround: state['alt_baro'] === 'ground',
            velocity: state['gs'],
            verticalRate: state['baro_rate'],
            squawk: state['squawk'],
            emergencyStatus: null,
        }
    }

    getPlanesBySquawk(squawk: number): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('Dump1090 TrackSource does not support squawk lookup at this time');
            resolve(null);
        });
    }

    getPlanesByType(type: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('Dump1090 TrackSource does not support type lookup at this time');
            resolve(null);
        });
    }

    getPlanesByOperator(operator: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('Dump1090 TrackSource does not support operator lookup at this time');
            resolve(null);
        });
    }
}
