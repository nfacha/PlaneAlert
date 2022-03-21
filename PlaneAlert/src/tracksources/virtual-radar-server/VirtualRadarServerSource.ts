import axios from "axios";
import {PlaneAlert} from "../../PlaneAlert";
import {PlaneTrackResponse} from "../PlaneTrackResponse";
import {TrackSource} from "../TrackSource";

export class VirtualRadarServerSource implements TrackSource {

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse | null> {
        PlaneAlert.log.debug(`Getting plane status for ${icao24} from VRS`);
        const rx = await axios.get(`${PlaneAlert.config['VRS_BASE']}/AircraftList.json?fIcoQ=${icao24.toLowerCase()}`, {
            auth: {
                username: PlaneAlert.config['VRS_USERNAME'],
                password: PlaneAlert.config['VRS_PASSWORD']
            }
        })
        if (rx.data['acList'] === null) {
            return null;
        }
        if (rx.data['acList'].length === 0) {
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
}
