import axios from "axios";
import {PlaneAlert} from "../../index";
import {PlaneTrackResponse} from "../PlaneTrackResponse";
import {TrackSource} from "../TrackSource";
import {PlaneDetail} from "./types/PlaneDetail";

export class FachaDevSource implements TrackSource {
    private static BASE = 'https://api.facha.dev/';

    public static async getPlaneDetailsByIcao(icao24: string): Promise<PlaneDetail | null> {
        return new Promise<PlaneDetail | null>(async (resolve, reject) => {
            PlaneAlert.log.debug(`Getting plane detail for ${icao24} from Api.Facha.Dev`);
            try {
                const rx = await axios.get(`https://api.facha.dev/v1/aircraft/detail/icao/${icao24}`, PlaneAlert.config.tracksource.FachaDev.token === null ? undefined : {headers: {'Authorization': `${PlaneAlert.config.tracksource.FachaDev.token}`}});
                if (rx.status !== 200) {
                    return null;
                }
                resolve(rx.data);
            } catch (e) {
                reject(e);
            }
        });
    }

    public static async getPlanesByOperator(operator: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise<PlaneTrackResponse[] | null>(async (resolve, reject) => {
            PlaneAlert.log.debug(`Getting planes and their statuses for ${operator} from Api.Facha.Dev`);
            try {
                const rx = await axios.get(`https://api.facha.dev/v1/aircraft/live/operator/${operator}`, PlaneAlert.config.tracksource.FachaDev.token === null ? undefined : {headers: {'Authorization': `${PlaneAlert.config.tracksource.FachaDev.token}`}});
                if (rx.status !== 200) {
                    return null;
                }
                const state = rx.data;
                if (state.error !== undefined) {
                    resolve(null);
                }


                let aircraft: PlaneTrackResponse[] = [];
                state.forEach((plane: any) => {
                    aircraft.push({
                        registration: plane['reg'],
                        icao24: plane['icao'],
                        callsign: plane['callsign'],
                        longitude: plane['lon'],
                        latitude: plane['lat'],
                        barometricAltitude: plane['baroAltitude'],
                        onGround: plane['onGround'],
                        velocity: plane['speed'],
                        verticalRate: plane['verticalRate'],
                        squawk: plane['squawk'],
                        emergencyStatus: null,
                    })
                })
                resolve(aircraft);
            } catch (e) {
                reject(e);
            }
        });
    }

    public static async getPlanesByType(type: string): Promise<PlaneTrackResponse[] | null> {
        return new Promise<PlaneTrackResponse[] | null>(async (resolve, reject) => {
            PlaneAlert.log.debug(`Getting planes and their statuses for ${type} from Api.Facha.Dev`);
            try {
                const rx = await axios.get(`https://api.facha.dev/v1/aircraft/live/type/${type}`, PlaneAlert.config.tracksource.FachaDev.token === null ? undefined : {headers: {'Authorization': `${PlaneAlert.config.tracksource.FachaDev.token}`}});
                if (rx.status !== 200) {
                    return null;
                }
                const state = rx.data;
                if (state.error !== undefined) {
                    resolve(null);
                }
                let aircraft: PlaneTrackResponse[] = [];
                state.forEach((plane: any) => {
                    aircraft.push({
                        registration: plane['reg'],
                        icao24: plane['icao'],
                        callsign: plane['callsign'],
                        longitude: plane['lon'],
                        latitude: plane['lat'],
                        barometricAltitude: plane['baroAltitude'],
                        onGround: plane['onGround'],
                        velocity: plane['speed'],
                        verticalRate: plane['verticalRate'],
                        squawk: plane['squawk'],
                        emergencyStatus: null,
                    })
                });
                resolve(aircraft);
            } catch (e) {
                reject(e);
            }
        });
    }

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null> {
        return new Promise<PlaneTrackResponse | null>(async (resolve, reject) => {
            PlaneAlert.log.debug(`Getting plane status for ${icao24} from Api.Facha.Dev`);
            try {
                const rx = await axios.get(`https://api.facha.dev/v1/aircraft/live/icao/${icao24}`, PlaneAlert.config.tracksource.FachaDev.token === null ? undefined : {headers: {'Authorization': `${PlaneAlert.config.tracksource.FachaDev.token}`}});
                if (rx.status !== 200) {
                    return null;
                }
                const state = rx.data;
                if (state.error !== undefined) {
                    resolve(null);
                }


                resolve({
                    icao24: icao24,
                    callsign: state['callsign'],
                    longitude: state['lon'],
                    latitude: state['lat'],
                    barometricAltitude: state['baroAltitude'],
                    onGround: state['onGround'],
                    velocity: state['speed'],
                    verticalRate: state['verticalRate'],
                    squawk: state['squawk'],
                    emergencyStatus: null,
                });
            } catch (e) {
                reject(e);
            }
        });
    }
}
