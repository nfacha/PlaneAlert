import axios from "axios";
import {PlaneAlert} from "../../index";
import {PlaneTrackResponse} from "../PlaneTrackResponse";
import {TrackSource} from "../TrackSource";

export class VirtualRadarServerSource implements TrackSource {

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null> {
        PlaneAlert.log.debug(`Getting plane status for ${icao24} from VRS`);
        if (PlaneAlert.config.tracksource.vrs.username === null) {
            PlaneAlert.log.error(`VRS username not set`);
            return null;
        }
        if (PlaneAlert.config.tracksource.vrs.password === null) {
            PlaneAlert.log.error(`VRS password not set`);
            return null;
        }
        const rx = await axios.get(`${PlaneAlert.config.tracksource.vrs.base}/AircraftList.json?fIcoQ=${icao24.toLowerCase()}`, {
            auth: (PlaneAlert.config.tracksource.vrs.username === null || PlaneAlert.config.tracksource.vrs.password === null) ? undefined : {
                username: PlaneAlert.config.tracksource.vrs.username,
                password: PlaneAlert.config.tracksource.vrs.password
            }
        })
        if (rx.data['acList'] === null) {
            return null;
        }
        if (rx.data['acList'].length === 0) {
            return null;
        }
        if (rx.data['states'] === undefined) {
            return null;
        }
        const state = rx.data['states'][0];
        return {
            icao24: icao24,
            callsign: state['Call'].trim(),
            longitude: state['Long'],
            latitude: state['Lat'],
            barometricAltitude: state['Alt'],
            onGround: state['Gnd'],
            velocity: state['Spd'],
            verticalRate: state['Vsi'],
            squawk: state['Sqk'],
            emergencyStatus: null,
        }
    }

    getPlanesBySquawk(squawk: number): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('VRS TrackSource does not support squawk lookup at this time');
            resolve(null);
        });
    }

    getPlanesByType(type: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('VRS TrackSource does not support type lookup at this time');
            resolve(null);
        });
    }

    getPlanesByOperator(operator: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise((resolve, reject) => {
            PlaneAlert.log.error('VRS TrackSource does not support operator lookup at this time');
            resolve(null);
        });
    }
}
