import axios from "axios";
import {PlaneAlert} from "../../PlaneAlert";
import {PlaneTrackResponse} from "../PlaneTrackResponse";
import {TrackSource} from "../TrackSource";

export class FachaDevSource implements TrackSource {
    private BASE = 'https://api.facha.dev/';

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null> {
        PlaneAlert.log.debug(`Getting plane status for ${icao24} from Api.Facha.Dev`);
        try {
            const rx = await axios.get(`${this.BASE}v1/aircraft/live/icao/${icao24}`, PlaneAlert.config['FachaDevToken'] === '' ? undefined : {headers: {'Authorization': `${PlaneAlert.config['FachaDevToken']}`}});
            if (rx.status !== 200) {
                return null;
            }
            const state = rx.data;
            return {
                icao24: icao24,
                callsign: state['callsign'].trim(),
                longitude: state['lon'],
                latitude: state['lat'],
                barometricAltitude: state['altitude'],
                onGround: state['ground'],
                velocity: state['speed'],
                verticalRate: state['verticalRate'],
                squawk: state['squawk'],
                emergencyStatus: null,
            }
        } catch (e) {
            return null;
        }
    }
}
