import axios from "axios";
import {PlaneAlert} from "../PlaneAlert";
import {PlaneTrackResponse} from "./PlaneTrackResponse";
import {Plane} from "../entities/Plane";
import {TrackSource} from "./TrackSource";

export class OpenSkySource implements TrackSource{
    private BASE = 'https://opensky-network.org/api/';

    public async getPlaneStatus(icao24: string): Promise<PlaneTrackResponse|null>{
        PlaneAlert.log.debug(`Getting plane status for ${icao24} from OPSN`);
        const rx = await axios.get(`${this.BASE}states/all?icao24=${icao24}`)
        if(rx.data['states'] === null){
            return null;
        }
        const state = rx.data['states'][0];
        return {
            icao24: icao24,
            callsign: state[1].trim(),
            longitude: state[5],
            latitude: state[6],
            barometricAltitude: state[7],
            onGround: state[8],
            velocity: state[9],
            verticalRate: state[11],
            squawk: state[14],
            emergencyStatus: null,
        }
    }
}
